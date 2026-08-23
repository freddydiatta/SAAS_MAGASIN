import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { createHash } from "https://deno.land/std@0.119.0/hash/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // PayDunya envoie l'IPN en application/x-www-form-urlencoded avec des
    // clés imbriquées façon PHP ("data[invoice][token]", etc.), jamais en
    // JSON — confirmé en conditions réelles (payload capturé : response_code,
    // hash, invoice.token, custom_data.business_id, status, tous sous
    // "data"). req.json() plantait donc sur CHAQUE appel réel, et ce webhook
    // n'avait en pratique jamais confirmé un seul paiement avant ce correctif.
    const rawBody = await req.text();
    const params: Record<string, unknown> = {};
    for (const [key, value] of new URLSearchParams(rawBody).entries()) {
      const path = key.replace(/\]/g, '').split('[');
      let node = params;
      for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        if (typeof node[segment] !== 'object' || node[segment] === null) node[segment] = {};
        node = node[segment] as Record<string, unknown>;
      }
      node[path[path.length - 1]] = value;
    }
    const payload: any = (params as any).data;

    // PayDunya sends the master key in the body as 'hash' to verify it's from them
    const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY') || "";
    const expectedHash = createHash("sha512").update(PAYDUNYA_MASTER_KEY).toString();

    if (payload?.hash !== expectedHash) {
       console.error("Invalid Hash!");
       return new Response(JSON.stringify({ error: "Invalid Hash" }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400
       });
    }

    const transactionStatus = payload.status;
    const token = payload.invoice.token;
    const customData = payload.custom_data;
    const businessId = customData.business_id;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (transactionStatus === "completed") {
      // 1. Update payment status (on relit le montant réellement facturé
      // depuis notre propre table plutôt que de reparser le payload
      // PayDunya, pour le calcul de commission ci-dessous).
      const { data: paymentRow } = await supabaseAdmin
        .from('payments')
        .update({ status: 'successful' })
        .eq('transaction_id', token)
        .select('amount')
        .maybeSingle();

      // 2. Extend subscription by 30 days
      // First, get the current end date
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('subscription_end_date, user_id')
        .eq('id', businessId)
        .single();

      let newEndDate = new Date();
      if (business && business.subscription_end_date) {
        const currentEnd = new Date(business.subscription_end_date);
        if (currentEnd > new Date()) {
          newEndDate = currentEnd; // Start adding from current end date if not yet expired
        }
      }

      newEndDate.setDate(newEndDate.getDate() + 30); // Add 30 days

      await supabaseAdmin
        .from('businesses')
        .update({
          subscription_status: 'active',
          subscription_end_date: newEndDate.toISOString()
        })
        .eq('id', businessId);

      // 3. Commission d'affiliation, si le propriétaire de ce commerce a été
      // parrainé (table referrals). N'importe quel souci ici est journalisé
      // mais ne doit jamais faire échouer la confirmation du paiement lui
      // même — c'est un traitement annexe, pas le cœur du webhook.
      try {
        if (business?.user_id && paymentRow?.amount) {
          const { data: referral } = await supabaseAdmin
            .from('referrals')
            .select('id, affiliate_id, status')
            .eq('referred_user_id', business.user_id)
            .maybeSingle();

          if (referral) {
            const { data: affiliate } = await supabaseAdmin
              .from('affiliates')
              .select('commission_rate, total_earnings')
              .eq('id', referral.affiliate_id)
              .maybeSingle();

            if (affiliate) {
              const commissionAmount = (Number(paymentRow.amount) * Number(affiliate.commission_rate)) / 100;

              await supabaseAdmin.from('commissions').insert({
                affiliate_id: referral.affiliate_id,
                referral_id: referral.id,
                amount: commissionAmount,
                status: 'pending',
              });

              await supabaseAdmin
                .from('affiliates')
                .update({ total_earnings: Number(affiliate.total_earnings) + commissionAmount })
                .eq('id', referral.affiliate_id);

              if (referral.status !== 'active') {
                await supabaseAdmin.from('referrals').update({ status: 'active' }).eq('id', referral.id);
              }
            }
          }
        }
      } catch (commissionError) {
        console.error('Erreur traitement commission affiliation:', commissionError);
      }
    } else {
      // Payment failed or cancelled
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('transaction_id', token);
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})
