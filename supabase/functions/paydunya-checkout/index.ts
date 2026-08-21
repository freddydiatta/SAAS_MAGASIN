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
    const { business_id } = await req.json()

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
    if (userError) throw new Error('Erreur getUser: ' + userError.message)
    if (!user) throw new Error('Utilisateur introuvable (Non autorisé)')

    // Retrieve plan to determine price
    const plan = user.user_metadata?.subscription_plan || 'essential';
    const amount = plan === 'business' ? 25000 : 15000;

    // 2. Setup Service Role Client for admin tasks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
        website_url: "https://votre-site.com" // Remplace par ton URL
      },
      custom_data: {
        business_id: business_id
      }
    };

    const paydunyaRes = await fetch("https://app.paydunya.com/api/v1/checkout-invoice/create", {
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
