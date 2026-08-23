import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables. Please check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Réplique la formule par défaut de supabase-js pour la clé de stockage de
// session (`sb-<project-ref>-auth-token`, dérivée du hostname du projet).
// offlineCashierAuth.js en a besoin pour écrire une session directement en
// localStorage SANS passer par supabase.auth.setSession() — cette méthode
// fait toujours un appel réseau (vérification côté serveur, ou
// rafraîchissement si expiré) même pour un jeton encore valide, donc échoue
// systématiquement hors-ligne. getSession(), lui, lit le stockage direct et
// ne tente un appel réseau que si le jeton est réellement expiré.
// Si une future version de @supabase/supabase-js change ce format interne,
// la restauration hors-ligne cessera silencieusement de fonctionner
// (dégradation propre : il faudra juste se reconnecter en ligne).
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
