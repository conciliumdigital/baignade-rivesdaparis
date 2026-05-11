# Changelog

Toutes les modifications notables apportées à ce projet sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versioning [SemVer](https://semver.org/lang/fr/).

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
