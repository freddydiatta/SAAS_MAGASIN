import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import webpush from 'npm:web-push@3.6.7'

// Jamais appelée depuis un navigateur (aucun en-tête CORS nécessaire) :
// uniquement par process_sale via pg_net (server-à-serveur), authentifié
// par un secret partagé (pas un JWT utilisateur) plutôt que la clé
// service_role complète — un secret dédié qui ne permet que de déclencher
// un envoi de notification, rien d'autre en cas de fuite.
serve(async (req) => {
  try {
    const sharedSecret = req.headers.get('x-push-secret')
    if (!sharedSecret || sharedSecret !== Deno.env.get('PUSH_NOTIFY_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { business_id, title, body } = await req.json()
    if (!business_id) throw new Error('business_id manquant.')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('business_id', business_id)
    if (error) throw error

    webpush.setVapidDetails(
      'mailto:contact@gestionpro.app',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    const payload = JSON.stringify({ title, body })

    const results = await Promise.allSettled(
      (subscriptions || []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    // Un abonnement expiré/révoqué renvoie 404/410 — on le supprime pour ne
    // pas réessayer indéfiniment un appareil qui ne recevra plus jamais rien.
    const staleEndpoints = (subscriptions || [])
      .filter((_, i) => {
        const r = results[i]
        return r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)
      })
      .map((s) => s.endpoint)

    if (staleEndpoints.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
    }

    return new Response(JSON.stringify({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      total: results.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erreur envoi notification push:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
