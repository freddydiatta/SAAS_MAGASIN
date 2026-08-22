# GestionPro

Application de gestion (caisse, stock, réservations) multi-activités pour commerces sénégalais : quincaillerie/boutique, pièces moto, villas en location, restaurant. PWA React installable, fonctionne hors-ligne et synchronise automatiquement au retour du réseau.

## Stack technique

- **Frontend** : React 19 + Vite 8, Tailwind CSS 4, React Router 7, TanStack React Query 5 (avec persistance IndexedDB pour le mode hors-ligne), Framer Motion, react-hook-form + Zod pour la validation.
- **Backend** : Supabase (Postgres 17, Auth, Row Level Security, Edge Functions Deno).
- **Paiement** : PayDunya (abonnement SaaS mensuel).
- **Tests** : Vitest + Testing Library. **Lint** : oxlint.

## Démarrage local

```bash
npm install
cp .env.example .env.local   # renseigner les variables (voir ci-dessous)
npm run dev
```

Autres commandes utiles :

```bash
npm run test        # suite de tests (une seule passe)
npm run test:watch  # tests en mode watch
npm run lint         # oxlint
npm run build        # build de production
npm run preview      # prévisualiser le build
```

## Variables d'environnement

Frontend (`.env.local`, voir `.env.example`) :

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase |

Secrets des Edge Functions (à configurer dans Supabase Dashboard → Edge Functions → Secrets, pas dans `.env.local`) :

| Variable | Utilisée par |
|---|---|
| `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` | `paydunya-checkout`, `paydunya-webhook` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase à chaque Edge Function, pas besoin de les configurer.

## Base de données Supabase

`supabase/setup.sql` est le script de référence pour une installation neuve (schéma complet, RLS, fonctions RPC). Il est **destructeur** (`DROP TABLE IF EXISTS`) : à ne jouer que sur un projet Supabase vide.

`supabase/patches/` contient les migrations incrémentales appliquées après la mise en place initiale (correctifs de sécurité, RBAC caissiers, etc.) — idempotentes, jouables sur une base contenant déjà des données.

`supabase/functions/` contient les Edge Functions (paiement PayDunya, connexion/gestion des caissiers).

## Rôles et accès

Deux rôles par commerce : **propriétaire** (compte email/mot de passe, accès complet y compris Paramètres et Logs de sécurité) et **caissier** (code PIN à 4 chiffres, accès à tout sauf Paramètres/Logs de sécurité). Voir `src/contexts/BusinessContext.jsx` et `supabase/functions/{create-cashier,cashier-login}`.

## Architecture (repères rapides)

- `src/pages/` — une page par route, groupées par vertical métier (`retail/`, `villas/`, `restaurant/`, `affiliate/`, `settings/`, `auth/`).
- `src/services/` — fonctions d'accès aux données (Supabase) partagées entre pages.
- `src/hooks/` — logique métier extraite des composants (requêtes, mutations, calculs) pour rester testable indépendamment du rendu.
- `src/components/Modal.jsx`, `src/components/DataTable.jsx` — composants UI partagés (fond de modale animé, tableau avec états chargement/vide).
- `src/lib/validation.js` — schémas Zod de validation des formulaires.
