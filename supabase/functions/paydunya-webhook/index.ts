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
    const payload = await req.json()
    
    // PayDunya sends the master key in the body as 'hash' to verify it's from them
    // Note: In a real production environment, you MUST verify this hash
    const PAYDUNYA_MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY') || "";
    const expectedHash = createHash("sha512").update(PAYDUNYA_MASTER_KEY).toString();
    
    if (payload.hash !== expectedHash) {
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
      // 1. Update payment status
      await supabaseAdmin
        .from('payments')
        .update({ status: 'successful' })
        .eq('transaction_id', token);

      // 2. Extend subscription by 30 days
      // First, get the current end date
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('subscription_end_date')
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
