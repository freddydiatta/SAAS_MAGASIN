import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Restreint aux origines de l'app (pas '*') : cette fonction n'a de sens
// qu'appelée depuis notre propre frontend, jamais depuis un navigateur sur
// un autre site. Sans effet sur un appel serveur-à-serveur (curl, script) —
// CORS n'est vérifié que par les navigateurs — mais bloque une page tierce
// qui tenterait d'appeler cette fonction authentifiée depuis le navigateur
// d'un utilisateur.
const ALLOWED_ORIGINS = ['https://saas-magasin.vercel.app', 'http://localhost:5173', 'http://localhost:4173']

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// --- Crypto helpers (chiffrement du mot de passe généré pour le caissier,
// hash du PIN). Web Crypto natif à Deno, pas de dépendance externe. ---

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

async function encryptText(plain: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial,
    256
  )
  return `${bytesToHex(salt)}:${bytesToHex(new Uint8Array(bits))}`
}

function randomPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID()
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { business_id, name, pin } = await req.json()

    if (!business_id || !name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Nom et commerce requis.')
    }
    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new Error('Le code PIN doit contenir exactement 4 chiffres.')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error("Header Authorization manquant. Assurez-vous d'être connecté.")
    }

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

    // Seul le propriétaire du commerce peut créer un caissier pour ce commerce.
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .eq('user_id', caller.id)
      .maybeSingle()
    if (businessError) {
      console.error('Erreur vérification commerce:', businessError)
      throw new Error("Impossible de vérifier ce commerce pour le moment.")
    }
    if (!business) throw new Error("Seul le propriétaire du commerce peut ajouter un caissier.")

    const email = `cashier-${crypto.randomUUID()}@internal.gestionpro.app`
    const password = randomPassword()

    const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'cashier', business_id, name: name.trim() },
    })
    if (createUserError || !created?.user) {
      throw new Error(createUserError?.message || "Erreur lors de la création du compte caissier.")
    }

    const pinHash = await hashPin(pin)
    const encryptedCredentials = await encryptText(JSON.stringify({ email, password }))

    const { error: insertError } = await supabaseAdmin.from('business_members').insert({
      business_id,
      user_id: created.user.id,
      name: name.trim(),
      role: 'cashier',
      pin_hash: pinHash,
      encrypted_credentials: encryptedCredentials,
    })
    if (insertError) {
      // Rollback: don't leave an orphaned auth user if the membership row failed.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      console.error('Erreur création caissier:', insertError)
      throw new Error("Erreur lors de la création du caissier.")
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
