# Baignade Rives d'Paris

Application web de réservation pour la zone de baignade estivale de Neuilly-sur-Marne.

**Stack** : Vite · React 18 · TypeScript · Tailwind · React Router · Supabase (Postgres + Auth Magic Link + Edge Functions) · Stripe · QR code.

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # à renseigner avec vos clés Supabase + Stripe
npm run dev
```

L'app démarre sur `http://localhost:5173`. **Mode démo** sans `.env.local` : créneaux fictifs, pas de paiement réel, pas de persistance.

## Structure

```
src/
├── components/        # UI réutilisable (Header, Footer, CookieBanner, RequireAuth)
├── layouts/           # PublicLayout, AdminLayout
├── pages/             # Pages publiques + admin/* + staff/*
├── lib/               # supabase.ts, auth.tsx, format.ts, slots.ts, demoData.ts
├── types/             # Types alignés avec le schéma Postgres
└── version.ts         # Version affichée dans le footer

supabase/
├── migrations/        # Schéma SQL (tables, RLS, triggers)
└── functions/         # Edge functions Deno (Stripe checkout, webhook, scan QR, email)

public/                # robots.txt, sitemap.xml, favicon.svg
```

## Fonctionnalités V1 livrées

### Public
- Landing SEO (Open Graph, Twitter Cards, sitemap)
- Calendrier dynamique des créneaux (affichage temps réel, places restantes, créneaux fermés)
- Tunnel de réservation (1-6 personnes, adultes/enfants, RGPD)
- Authentification Magic Link (sans mot de passe)
- Stripe Checkout (CB / Apple Pay / Google Pay)
- Confirmation + QR code généré + envoi email
- Infos pratiques, CGU, Confidentialité, Mentions légales, Accessibilité

### Espace utilisateur
- Mes réservations + statut
- Détail + QR code téléchargeable
- Annulation (J-1)
- Profil + préférences notifications
- Suppression compte (RGPD droit à l'oubli)

### Back-office admin
- Tableau de bord (réservations, recettes, taux de remplissage, NPS)
- Gestion des créneaux (CRUD + génération en masse + ouverture/fermeture rapide)
- Liste des réservations (recherche, filtres, export CSV)
- Communication (templates, segments, envoi test)
- Satisfaction (avis, NPS)
- Gestion des comptes staff
- Paramètres

### Staff
- Scanner QR mobile-first (caméra)
- Validation visuelle vert/rouge < 1s + bip sonore
- Anti-réutilisation
- Historique des scans

## Edge Functions Supabase

| Fonction | Rôle |
|---|---|
| `create-checkout-session` | Crée une session Stripe Checkout pour une réservation |
| `stripe-webhook` | Réceptionne les événements Stripe, génère le QR token, déclenche l'email |
| `send-confirmation-email` | Envoie le mail transactionnel (Resend) avec QR code en pièce jointe |
| `scan-qr` | Vérifie un QR + marque la réservation comme utilisée + journalise |

## Déploiement

```bash
npm run build
# déployer dist/ sur Vercel / Netlify / Scaleway / OVH
# déployer les edge functions : supabase functions deploy <nom>
# appliquer le schéma : supabase db push
```

## RGPD

- Hébergement Supabase région UE
- Cookies strictement nécessaires (banner)
- Pas de tracking tiers
- Droit à l'oubli en un clic depuis le profil
- Données de réservation : conservation 13 mois

## Accessibilité

- Skip-link, focus-visible, ARIA labels
- Cible RGAA 4.1 niveau AA (audit complet à finaliser)
- Mobile-first

## Variables d'environnement

Front (`.env.local`) :
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_APP_URL`

Edge Functions (Supabase secrets) :
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `APP_URL`

---

Conçu par **CONCILIUM** pour la **Commune de Neuilly-sur-Marne** · 2026.
