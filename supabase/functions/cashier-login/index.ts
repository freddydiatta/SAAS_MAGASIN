import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

// --- Crypto helpers (mêmes primitives que create-cashier, dupliquées ici
// car chaque Edge Function est déployée indépendamment). ---

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
  return arr
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(serviceRoleKey),
    'HKDF',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('gestionpro-cashier-credentials'),
      info: new TextEncoder().encode('aes-gcm-key'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function decryptText(encoded: string): Promise<string> {
  const key = await getEncryptionKey()
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuf)
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = hexToBytes(saltHex)
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256
  )
  return bytesToHex(new Uint8Array(bits)) === hashHex
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { member_id, pin } = await req.json()
    if (!member_id || !pin) throw new Error('Requête invalide.')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Header Authorization manquant. Assurez-vous d'être connecté.")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !caller) throw new Error('Utilisateur introuvable (Non autorisé)')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: member, error: memberError } = await supabaseAdmin
      .from('business_members')
      .select('id, business_id, user_id, name, is_active, pin_hash, encrypted_credentials, failed_pin_attempts, locked_until')
      .eq('id', member_id)
      .maybeSingle()
    if (memberError) throw memberError
    if (!member || !member.is_active) throw new Error('PIN invalide.')

    // Le compte qui initie le changement d'utilisateur doit déjà appartenir
    // au même commerce (propriétaire ou autre caissier) : le PIN seul ne
    // suffit pas à appeler cette fonction depuis l'extérieur de l'app.
    const { data: callerBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', member.business_id)
      .eq('user_id', caller.id)
      .maybeSingle()
    const { data: callerMembership } = await supabaseAdmin
      .from('business_members')
      .select('id')
      .eq('business_id', member.business_id)
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!callerBusiness && !callerMembership) throw new Error('PIN invalide.')

    if (member.locked_until && new Date(member.locked_until) > new Date()) {
      throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
    }

    const isValid = await verifyPin(pin, member.pin_hash)

    if (!isValid) {
      const attempts = (member.failed_pin_attempts || 0) + 1
      const update: Record<string, unknown> = { failed_pin_attempts: attempts }
      if (attempts >= MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
        update.failed_pin_attempts = 0
      }
      await supabaseAdmin.from('business_members').update(update).eq('id', member.id)
      throw new Error('PIN invalide.')
    }

    await supabaseAdmin
      .from('business_members')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('id', member.id)

    const { email, password } = JSON.parse(await decryptText(member.encrypted_credentials))

    return new Response(JSON.stringify({ email, password, name: member.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
