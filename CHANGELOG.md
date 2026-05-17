# Changelog

Toutes les modifications notables apportées à ce projet sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versioning [SemVer](https://semver.org/lang/fr/).

## [1.1.3] — 2026-05-17

### 🔒 Correctifs de sécurité

- **Edge Function `scan-qr` — bypass d'autorisation (HIGH)** : l'identité
  et le rôle de l'agent sont désormais dérivés du JWT du caller, plus
  jamais du corps de la requête. Échec fermé si non authentifié ou rôle
  insuffisant (avant : `scanned_by` fourni par l'appelant, et contrôle
  ignoré si absent → un usager auto-inscrit pouvait griller un QR et
  obtenir l'URL signée d'un justificatif de domicile / PII).
- **`scan-qr` — minimisation PII (MEDIUM)** : l'URL signée du justificatif
  n'est générée qu'après autorisation et uniquement pour un accès
  `valid` (plus exposée sur `already_used` / `wrong_slot`).
- **Seed démo `02_seed_backoffice.sql` — comptes privilégiés (HIGH)** :
  suppression du mot de passe en dur ; comptes de démo rendus non
  connectables (`banned_until` 2999). La démo back-office se fait avec
  le compte admin réel de l'opérateur. `README.md` mis à jour.

> ⚠️ Après merge : **redéployer l'Edge Function `scan-qr`** (le correctif
> ne prend effet qu'au redéploiement). Si `02_seed_backoffice.sql` a déjà
> été appliqué en prod avec l'ancienne version, lancer `99_cleanup_demo.sql`
> puis re-seeder.

## [1.1.2] — 2026-05-17

### 🚚 Migration d'hébergement Cloudflare → Netlify

- Hébergement front migré de **Cloudflare (Workers Assets)** vers **Netlify** (déploiement Git automatique sur `main`, config `netlify.toml`).
- Site en ligne sur le domaine cible **`https://baignade.lesrivesdeparis.fr`** (CNAME OVH `baignade` → `exquisite-sable-8f9d45.netlify.app`, la zone DNS reste chez OVH, SSL Let's Encrypt provisionné automatiquement).
- Suppression de `wrangler.jsonc` (config Cloudflare devenue inutile).
- `public/_headers` : commentaire rendu générique (fichier compatible Netlify, `netlify.toml` fait foi).
- Documentation alignée Netlify : `HANDOFF.md`, `DEPLOY.md`, `README.md`.
- Cloudflare totalement abandonné (intégration Git déconnectée côté dashboard).

## [1.1.1] — 2026-05-17

### 🔧 Correction du nom de domaine cible

- Le domaine cible était incorrectement renseigné `rivesdaparis.fr` dans tout le projet ; valeur correcte : **`lesrivesdeparis.fr`** (sous-domaine `baignade.lesrivesdeparis.fr`).
- Corrigé dans : `index.html` (canonical + Open Graph), `public/sitemap.xml`, `public/robots.txt`, fallbacks `APP_URL` des Edge Functions `create-checkout-session` et `send-confirmation-email`, `FROM_EMAIL` (→ `baignade@lesrivesdeparis.fr`), texte de la politique de confidentialité, `.env.example`, documentation (`HANDOFF.md`, `DEPLOY.md`, `README.md`).
- Identifiants techniques inchangés : repo GitHub `baignade-rivesdaparis`, sous-domaine Cloudflare `…workers.dev`, comptes `baignade-rivesdaparis@tk7.fr`.
- ⚠️ Actions externes restantes : vérification du domaine `lesrivesdeparis.fr` côté Brevo, et secrets Supabase `APP_URL` / `FROM_EMAIL` à mettre à jour côté serveur.

## [1.1.0] — 2026-05-12

### ✨ Tarif habitant Neuilly-sur-Marne

- **Page de réservation** : nouveau bloc « Type de tarif » avec choix `Tarif habitant` / `Tarif normal` (radio-cards, recalcul du prix en temps réel)
- Si tarif habitant choisi :
  - Upload d'un **justificatif de domicile** obligatoire (JPG, PNG, WEBP ou PDF, max 5 Mo)
  - Case **« Je certifie sur l'honneur que je suis domicilié·e à Neuilly-sur-Marne »** (rappel article 441-1 du Code pénal)
- **Schéma SQL** (migration `20260512000000_resident_proof.sql`) :
  - `reservations.resident_proof_url` (text) et `reservations.honor_certification` (boolean)
  - Vue `slot_availability` étendue avec `price_resident_cents`
  - Bucket Storage privé `resident-proofs` + RLS (upload propriétaire, lecture staff/admin/manager)
- **Back-office admin** :
  - Colonne `Tarif` (badge Habitant/Extérieur)
  - Colonne `Justif.` avec lien « Voir » (URL signée 5 min)
  - Export CSV enrichi (type usager, présence justificatif)
- **Scanner staff** :
  - Affiche le détail famille (X adulte(s), Y enfant(s)) — le QR code gère déjà les inscriptions multiples via `nb_adults + nb_children`
  - Badge `Tarif habitant` + lien direct vers le justificatif (URL signée par l'Edge Function)
  - Mention « Justificatif non joint » si manquant
- **Edge Function `scan-qr`** : génère une URL signée du justificatif côté serveur, retourne `usager_type`, `honor_certification`, `proof_url`

### À appliquer en prod
- [ ] Exécuter la migration `20260512000000_resident_proof.sql` (SQL Editor Supabase ou `supabase db push`)
- [ ] Redéployer l'Edge Function `scan-qr` (`supabase functions deploy scan-qr --project-ref nunglkeqekxzpmushxty`)

## [1.0.2] — 2026-05-11

### 🚀 Mise en ligne sur Cloudflare Pages

- Déployé sur https://baignade-rivesdaparis.thomas-kolbe.workers.dev (Cloudflare Workers Assets)
- Upgrade **Vite 5 → 6** (pré-requis Cloudflare Pages wrangler v4)
- Suppression de `public/_redirects` (conflit avec `not_found_handling: single-page-application` de `wrangler.json`)
- `.gitignore` étendu : `supabase/.temp/`, `.wrangler/`, `wrangler.jsonc`
- **HANDOFF.md** ajouté : doc complète de reprise du projet pour changement de machine ou de collaborateur
- Secrets Supabase configurés : `APP_URL`, `FROM_NAME`, `FROM_EMAIL`, `BREVO_API_KEY`
- 4 Edge Functions déployées en production sur le projet `nunglkeqekxzpmushxty` (Frankfurt)

### ⏳ Reste à faire avant ouverture publique
- DNS : pointer `baignade.rivesdaparis.fr` vers Cloudflare (CNAME)
- Vérification domaine Brevo (3 enregistrements TXT)
- Création compte Stripe par la commune + injection des clés `STRIPE_*`
- Génération du planning saisonnier des créneaux (juillet-août 2026)

## [1.0.1] — 2026-05-11

### Adaptation hébergement budget zéro
- Support Cloudflare Pages : ajout de `public/_redirects` et `public/_headers` (SPA fallback + sécurité)
- Edge Function `send-confirmation-email` : compatibilité **Brevo** 🇫🇷 (RGPD natif, 300 emails/jour gratuits) en plus de Resend, détection auto via variables d'env
- Variables d'env ajoutées : `BREVO_API_KEY`, `FROM_EMAIL`, `FROM_NAME`
- DEPLOY.md réécrit pour le scénario 0 €/mois (Cloudflare Pages + Supabase Free + Brevo Free + Stripe)

## [1.0.0] — 2026-05-11

### 🚀 MVP initial — Prêt pour la mise en production

#### Public
- Landing page SEO (Open Graph, Twitter Cards, sitemap.xml, robots.txt)
- Calendrier dynamique des créneaux (affichage temps réel via la view `slot_availability`)
- Filtres : date, plage horaire, nombre de personnes, masquer les complets
- Tunnel de réservation < 3 minutes, 1 à 6 personnes (adultes/enfants)
- Authentification Magic Link (Supabase Auth, sans mot de passe)
- Stripe Checkout (CB, Apple Pay, Google Pay)
- Génération automatique du QR code + email transactionnel (Resend)
- Pages légales : CGU, Confidentialité, Mentions légales, Accessibilité RGAA
- Bandeau cookies RGPD

#### Espace utilisateur
- Liste des réservations + statut + référence
- Détail réservation + QR code téléchargeable
- Annulation jusqu'à J-1
- Profil & préférences notifications
- Suppression compte (droit à l'oubli RGPD)

#### Back-office admin
- Tableau de bord : réservations, recettes, taux de remplissage, NPS, répartition usagers
- Gestion des créneaux : CRUD, génération en masse (saisonnier), ouverture/fermeture rapide
- Liste des réservations : recherche, filtres avancés, export CSV
- Communication : templates, segments, preview, envoi test
- Avis & satisfaction (note moyenne, NPS, commentaires)
- Gestion des comptes staff (admin/manager/agent)
- Paramètres du service

#### Staff (mobile-first)
- Scanner QR code (caméra) avec validation visuelle vert/orange/rouge < 1s
- Bip sonore de feedback
- Anti-réutilisation (qr_used_at)
- Historique des scans

#### Backend Supabase
- Schéma SQL complet : 9 tables, 1 view, 3 enums, 4 triggers (anti-overbooking, auto-profile, updated_at)
- Row Level Security activée sur toutes les tables
- 4 Edge Functions Deno : `create-checkout-session`, `stripe-webhook`, `scan-qr`, `send-confirmation-email`

#### Infrastructure & sécurité
- Hébergement front : Vercel (région CDG1), alternatives Netlify et Docker/Scaleway
- Hébergement données : Supabase région UE (RGPD)
- Headers sécurité : HSTS, CSP, X-Frame-Options, Permissions-Policy
- Mode démo intégré (fonctionne sans Supabase configuré)
