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
    const { name, contact_info, message } = await req.json()

    if (!name?.trim() || !contact_info?.trim() || !message?.trim()) {
      throw new Error('Merci de remplir tous les champs.')
    }
    // Endpoint public, non authentifié : plafonds défensifs contre un abus
    // (script qui balancerait des payloads géants), pas de règle métier.
    if (name.length > 200 || contact_info.length > 200 || message.length > 5000) {
      throw new Error('Un des champs est trop long.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: insertError } = await supabaseAdmin
      .from('contact_messages')
      .insert({ name: name.trim(), contact_info: contact_info.trim(), message: message.trim() })
    if (insertError) throw insertError

    // Notification par email best-effort : le message est déjà enregistré
    // en base (source de vérité, consultable depuis le tableau de bord
    // Supabase) même si l'envoi d'email échoue — clé Resend absente/
    // invalide, panne du service, etc. Ne doit jamais faire échouer la
    // réponse renvoyée à l'utilisateur, qui a déjà bien été prise en compte.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const notifyEmail = Deno.env.get('CONTACT_NOTIFICATION_EMAIL')
    if (resendApiKey && notifyEmail) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'GestionPro <onboarding@resend.dev>',
            to: [notifyEmail],
            reply_to: contact_info.trim().includes('@') ? contact_info.trim() : undefined,
            subject: `Nouveau message de contact — ${name.trim()}`,
            text: `De : ${name.trim()}\nContact : ${contact_info.trim()}\n\n${message.trim()}`,
          }),
        })
        // fetch() only rejects on network errors, not HTTP error statuses —
        // without this, a bad/expired key or a Resend outage would fail
        // silently and never show up anywhere.
        if (!emailResponse.ok) {
          console.error('Erreur envoi email de notification:', emailResponse.status, await emailResponse.text())
        }
      } catch (emailError) {
        console.error('Erreur envoi email de notification:', emailError)
      }
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
