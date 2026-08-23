import { supabase } from '../lib/supabase';

// Enregistre le message (table contact_messages) et tente une notification
// email — voir supabase/functions/send-contact-message. Contrairement à
// l'ancienne modale, qui simulait juste l'envoi (setTimeout, rien nulle
// part), le message est réellement transmis.
export const submitContactMessage = async ({ name, contactInfo, message }) => {
    const { data, error } = await supabase.functions.invoke('send-contact-message', {
        body: { name, contact_info: contactInfo, message },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
};
