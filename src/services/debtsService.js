import { supabase } from '../lib/supabase';

// Jointe au reçu d'origine (s'il y en a un — une dette née d'une vente à
// crédit en a un, une dette saisie manuellement non) pour pouvoir afficher
// les articles pris par le client, pas juste le montant total.
export const fetchDebts = async (businessId) => {
    const { data, error } = await supabase
        .from('debts')
        .select('*, receipt:receipts(id, sales(quantity, total_price, products(name)))')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const addDebt = async ({ businessId, customerName, customerPhone, amount, note, receiptId }) => {
    const { error } = await supabase.from('debts').insert([{
        business_id: businessId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        amount,
        note: note || null,
        receipt_id: receiptId || null,
    }]);
    if (error) throw error;
};

// Modification avec journal d'audit (voir update_debt). L'auteur est
// dérivé côté serveur depuis auth.uid() (current_actor_label), jamais
// envoyé par le client — audit de sécurité du 2026-09-10, un email client
// aurait pu être falsifié pour faire porter la correction à quelqu'un
// d'autre dans le journal Sécurité.
export const updateDebt = async ({ debtId, customerName, customerPhone, amount, note }) => {
    const { data, error } = await supabase.rpc('update_debt', {
        p_debt_id: debtId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone || null,
        p_amount: amount,
        p_note: note || null,
    });
    if (error) throw error;
    return data;
};

// paymentMethod ('cash' | 'mobile_money') : par quel moyen le client a
// remboursé. Sans lui, l'argent rentré ne peut pas être rattaché aux espèces
// ou au Mobile Money pour recouper la caisse (voir useFinances).
export const markDebtPaid = async ({ id, paymentMethod }) => {
    const { error } = await supabase
        .from('debts')
        .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: paymentMethod })
        .eq('id', id);
    if (error) throw error;
    return id;
};

export const deleteDebt = async (id) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw error;
    return id;
};
