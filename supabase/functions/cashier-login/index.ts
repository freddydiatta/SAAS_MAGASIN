import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      .select('id, business_id, user_id, name, is_active, pin_hash, encrypted_credentials')
      .eq('id', member_id)
      .maybeSingle()
    if (memberError) throw memberError

    // Journalise une tentative de connexion caissier dans audit_logs (lu
    // uniquement par le propriétaire). service_role : ignore la RLS.
    const logAttempt = (action: string, details: Record<string, unknown> = {}) => {
      if (!member) return
      supabaseAdmin.from('audit_logs').insert({
        business_id: member.business_id,
        user_email: member.name,
        action,
        details,
      }).then(() => {}, () => {})
    }

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

    const isValid = await verifyPin(pin, member.pin_hash)

    // Compte + verrouillage gérés en une seule transaction SQL (voir
    // record_pin_attempt dans supabase/patches/2026-08-23_atomic_pin_lockout.sql) :
    // avant, le compteur était lu puis réécrit séparément depuis ce code
    // (lire failed_pin_attempts, +1 en JS, écrire), ce qui permettait à des
    // tentatives concurrentes de toutes lire la même valeur de départ et de
    // ne jamais faire progresser le compteur jusqu'à 5 — le verrouillage
    // anti brute-force pouvait donc être contourné en envoyant plusieurs
    // requêtes en parallèle. Le FOR UPDATE de la fonction SQL sérialise ces
    // appels sur la ligne du caissier.
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .rpc('record_pin_attempt', { p_member_id: member.id, p_success: isValid })
      .single()
    if (attemptError) throw attemptError

    if (attempt?.is_locked) {
      logAttempt(
        attempt.just_locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED_PIN',
        attempt.just_locked ? {} : { reason: 'locked' }
      )
      throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
    }

    if (!isValid) {
      logAttempt('LOGIN_FAILED_PIN', { reason: 'wrong_pin', attempts: attempt?.failed_pin_attempts })
      throw new Error('PIN invalide.')
    }

    logAttempt('LOGIN_SUCCESS', { role: 'cashier' })

    const { email, password } = JSON.parse(await decryptText(member.encrypted_credentials))

    // pin_hash (déjà salé/PBKDF2, pas le PIN en clair) est renvoyé pour que
    // le client puisse mettre ce caissier en cache et permettre un nouveau
    // changement d'utilisateur vers lui sans réseau la prochaine fois — le
    // caller vient de prouver qu'il connaît le PIN correct à l'instant, ce
    // hash ne lui apprend donc rien qu'il n'a pas déjà démontré.
    return new Response(JSON.stringify({ email, password, name: member.name, pin_hash: member.pin_hash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
