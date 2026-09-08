-- ==========================================
-- MODIFICATION D'UNE DETTE, AVEC JOURNAL D'AUDIT
-- Corriger une erreur de saisie (montant, nom, téléphone, note) ne doit pas
-- se faire en douce — même schéma que modify_sale : SECURITY INVOKER
-- (s'appuie sur la policy RLS existante de public.debts pour
-- l'autorisation), écrit dans audit_logs uniquement si quelque chose a
-- réellement changé, avec l'état avant/après.
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_debt(
    p_debt_id uuid,
    p_user_email text,
    p_customer_name text,
    p_customer_phone text,
    p_amount numeric,
    p_note text
)
RETURNS public.debts
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_debt public.debts;
    v_changes jsonb;
BEGIN
    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dette introuvable';
    END IF;

    IF v_debt.customer_name IS DISTINCT FROM p_customer_name
        OR v_debt.customer_phone IS DISTINCT FROM p_customer_phone
        OR v_debt.amount IS DISTINCT FROM p_amount
        OR v_debt.note IS DISTINCT FROM p_note THEN

        v_changes := jsonb_build_object(
            'debt_id', p_debt_id,
            'before', jsonb_build_object(
                'customer_name', v_debt.customer_name,
                'customer_phone', v_debt.customer_phone,
                'amount', v_debt.amount,
                'note', v_debt.note
            ),
            'after', jsonb_build_object(
                'customer_name', p_customer_name,
                'customer_phone', p_customer_phone,
                'amount', p_amount,
                'note', p_note
            )
        );

        UPDATE public.debts
        SET customer_name = p_customer_name,
            customer_phone = p_customer_phone,
            amount = p_amount,
            note = p_note
        WHERE id = p_debt_id;

        INSERT INTO public.audit_logs (business_id, user_email, action, details)
        VALUES (v_debt.business_id, p_user_email, 'MODIFY_DEBT', v_changes);
    END IF;

    SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id;
    RETURN v_debt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_debt(uuid, text, text, text, numeric, text) TO authenticated;
