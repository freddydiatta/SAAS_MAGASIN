// data.invoice_url vient de l'Edge Function paydunya-checkout, qui relaie
// response_text tel que renvoyé par l'API PayDunya — une donnée externe,
// jamais tapée par l'utilisateur mais pas non plus sous notre contrôle.
// N'assigne jamais une telle valeur à window.location.href sans vérifier
// son schéma d'abord : un bug côté PayDunya (ou une réponse inattendue) qui
// renverrait autre chose qu'une vraie URL de paiement ne doit pas pouvoir
// déclencher une navigation vers un schéma javascript:/data:.
export const safeRedirect = (url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
        throw new Error('Lien de paiement invalide.');
    }
    window.location.href = url;
};
