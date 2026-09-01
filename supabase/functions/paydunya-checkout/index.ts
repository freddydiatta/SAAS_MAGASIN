import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Restreint aux origines de l'app (pas '*') — voir create-cashier/index.ts
// pour le détail du raisonnement.
const ALLOWED_ORIGINS = ['https://saas-magasin.vercel.app', 'http://localhost:5173', 'http://localhost:4173']

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { business_id, target_plan } = await req.json()
    if (!business_id) throw new Error('business_id manquant.')

    // 1. Check Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Header Authorization manquant. Assurez-vous d\'être connecté.')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError) {
      console.error('Erreur getUser:', userError)
      throw new Error('Session invalide. Reconnectez-vous.')
    }
    if (!user) throw new Error('Utilisateur introuvable (Non autorisé)')

    // 2. Setup Service Role Client for admin tasks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifie que l'appelant est bien le PROPRIÉTAIRE du commerce facturé
    // (pas seulement un utilisateur authentifié quelconque, ex. un compte
    // caissier) : sans ce contrôle, n'importe quel compte pouvait déclencher
    // un paiement/prolongation d'abonnement pour n'importe quel business_id
    // en le passant simplement dans le corps de la requête.
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (businessError) {
      console.error('Erreur vérification commerce:', businessError)
      throw new Error("Impossible de vérifier ce commerce pour le moment.")
    }
    if (!business) throw new Error('Commerce introuvable ou accès non autorisé.')

    // Retrieve plan to determine price. Source de vérité canonique côté
    // frontend : src/config/pricing.js — ce fichier tourne sur Deno et ne
    // peut pas l'importer directement, donc les montants sont dupliqués ici
    // volontairement et doivent être mis à jour ensemble.
    // target_plan (optionnel) permet un changement de forfait : sans lui on
    // refacture simplement le plan actuel (renouvellement classique) ; avec
    // lui, on facture le plan VISÉ — le webhook mettra à jour le compte vers
    // ce plan une fois le paiement confirmé (cf. paydunya-webhook).
    const currentPlan = user.user_metadata?.subscription_plan || 'essentiel';
    const plan = (target_plan === 'essentiel' || target_plan === 'business') ? target_plan : currentPlan;
    const amount = plan === 'business' ? 9000 : 5000;

    // 3. Prepare PayDunya Invoice
    const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')
    const PAYDUNYA_PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')
    const PAYDUNYA_TOKEN = Deno.env.get('PAYDUNYA_TOKEN')

    const payload = {
      invoice: {
        total_amount: amount,
        description: `Abonnement mensuel SaaS - Business ID: ${business_id}`
      },
      store: {
        name: "GestionPro SaaS",
        website_url: "https://saas-magasin.vercel.app"
      },
      custom_data: {
        business_id: business_id,
        target_plan: plan
      }
    };

    // PayDunya expose deux endpoints distincts : /api/v1 (production, exige
    // le KYC du compte marchand) et /sandbox-api/v1 (test, sans cette
    // exigence). Les deux acceptent leurs propres clés (test_xxx vs live_xxx)
    // mais l'URL elle-même ne change PAS automatiquement selon la clé
    // utilisée — l'appeler avec des clés de test sur l'URL de production
    // renvoie l'erreur PayDunya 1001 "KYC requis" même en pur mode test.
    const paydunyaBaseUrl = PAYDUNYA_PRIVATE_KEY?.startsWith('test_')
      ? "https://app.paydunya.com/sandbox-api/v1"
      : "https://app.paydunya.com/api/v1";

    const paydunyaRes = await fetch(`${paydunyaBaseUrl}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_MASTER_KEY || "",
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_PRIVATE_KEY || "",
        "PAYDUNYA-TOKEN": PAYDUNYA_TOKEN || ""
      },
      body: JSON.stringify(payload)
    });

    const paydunyaData = await paydunyaRes.json();

    if (paydunyaData.response_code !== "00") {
      console.error("PayDunya Error:", paydunyaData);
      throw new Error("Erreur PayDunya (" + paydunyaData.response_code + "): " + (paydunyaData.response_text || JSON.stringify(paydunyaData)));
    }

    // 4. Save Payment Intent to Supabase
    await supabaseAdmin.from('payments').insert({
      business_id: business_id,
      amount: amount,
      status: 'pending',
      provider: 'paydunya',
      transaction_id: paydunyaData.token,
      payment_url: paydunyaData.response_text
    });

    return new Response(
      JSON.stringify({ invoice_url: paydunyaData.response_text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
