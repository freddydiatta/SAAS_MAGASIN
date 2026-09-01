import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) throw new Error('Email et mot de passe requis.')

    const normalizedEmail = email.toLowerCase().trim()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifie le verrou AVANT de tenter l'authentification (évite un appel
    // inutile à Supabase Auth pour un compte déjà verrouillé) — mais c'est
    // record_login_attempt plus bas, avec son FOR UPDATE, qui fait
    // vraiment foi : un compte qui se verrouille pile entre cette lecture
    // et l'appel signInWithPassword ci-dessous sera quand même rattrapé
    // correctement à l'appel suivant.
    const { data: existing } = await supabaseAdmin
      .from('login_attempts')
      .select('locked_until')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
      return new Response(JSON.stringify({ success: false, locked: true, lockedUntil: existing.locked_until }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // L'authentification elle-même passe par un client anon normal (même
    // vérification qu'un signInWithPassword direct côté client) — cette
    // fonction ne fait qu'entourer cet appel d'un verrou serveur.
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({ email, password })

    const { data: attempt } = await supabaseAdmin
      .rpc('record_login_attempt', { p_email: normalizedEmail, p_success: !authError })
      .single()

    if (authError) {
      if (attempt?.is_locked) {
        return new Response(JSON.stringify({ success: false, locked: true, lockedUntil: attempt.locked_until }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({
        success: false,
        locked: false,
        remainingAttempts: Math.max(0, 5 - (attempt?.failed_attempts ?? 0)),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
