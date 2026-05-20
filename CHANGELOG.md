# Changelog

Toutes les modifications notables apportées à ce projet sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versioning [SemVer](https://semver.org/lang/fr/).

## [1.3.2] — 2026-05-20

### 🧭 En-tête pleine largeur

- La barre de navigation utilise désormais toute la largeur disponible
  (padding latéral `px-6 lg:px-10`) au lieu d'être contrainte par le
  conteneur `container-app` (max-width 1200 px). Logo collé à gauche,
  actions à droite — plus aéré sur grands écrans. Le contenu des pages
  reste, lui, dans le conteneur classique.

## [1.3.1] — 2026-05-20

### 🎨 Accent jaune solaire

- Couleur d'accent **#F5C111** (jaune solaire) en lieu et place du cyan
  #1ECDEB sur tous les titres en fond foncé : hero h1, h2 « Prêt à
  plonger ? » (carte `bg-brand-900`), trois rubriques du pied de page
  (`bg-slate-900`), titre du gabarit e-mail. Plus chaleureux, plus
  estival ; meilleur contraste sur bleu marine.

## [1.3.0] — 2026-05-20

### 🌊 Opérations saisonnières — liste d'attente, rappels auto, fermeture météo

Trois fonctionnalités demandées (#20, #21, #22) en un seul lot cohérent :
- **Liste d'attente** : sur un créneau complet, la page de réservation
  bascule sur un formulaire « M'inscrire en liste d'attente »
  (nombre de personnes). RPC `join_waitlist` / `leave_waitlist` côté
  serveur (SECURITY DEFINER) — le client ne peut pas s'inscrire
  s'il reste des places, si le créneau est fermé ou passé.
  Section dédiée dans *Mon espace* : voir ses inscriptions, se désinscrire,
  réserver directement quand une place se libère.
- **Notification automatique de place libérée** : trigger
  `notify_on_reservation_freed` (AFTER UPDATE/DELETE sur `reservations`)
  qui détecte un statut occupant → libérateur (`cancelled`, `refunded`,
  `expired`, `no_show`) et enfile un e-mail `waitlist_offered` pour la
  première personne en file ayant un nombre de places suffisant.
  Validité de l'offre : 24 h.
- **Rappels J-1 et H-1** : Edge Function `send-reminders` (mode `j1`,
  `h1` ou `both`) qui scanne les réservations confirmées dont le créneau
  démarre dans la fenêtre cible et enfile une ligne dans `notification_log`.
  Idempotent (filtre les `sent`/`pending` existants). À planifier en cron
  Supabase (1×/jour à 18h CET pour J-1, toutes les 30 min pour H-1).
- **Fermeture météo (admin)** : la modale de fermeture remplace le
  `prompt()`. Le trigger `notify_on_slot_closed` enfile automatiquement
  un e-mail `closure` (template existant) pour chaque réservation
  confirmée/pending/used du créneau. Compteur de personnes en liste
  d'attente affiché par créneau côté admin.
- **Worker générique d'envoi** : Edge Function `process-notifications`
  qui dépile `notification_log` (status='pending', `channel='email'`,
  templates `reminder_j1`, `reminder_h1`, `closure`, `waitlist_offered`,
  `satisfaction`). Réutilise le même gabarit sûr et les mêmes
  fournisseurs (Brevo prioritaire, Resend fallback) que
  `send-confirmation-email`. À planifier en cron (toutes les 5 min).
- **Template `waitlist_offered`** ajouté à `email_templates` (éditable
  comme les autres).
- **Vue `waitlist_admin`** : liste d'attente jointe avec slot + profil
  (pour future page de pilotage si besoin).

> ⚠️ Après merge : exécuter `20260520000000_season_ops.sql` (SQL Editor)
> puis déployer les deux Edge Functions `process-notifications` et
> `send-reminders`. Planifier les CRON Supabase (voir HANDOFF §3).

## [1.2.1] — 2026-05-20

### 🎨 Accent couleur sur fonds sombres

- Couleur d'accent **#1ECDEB** appliquée au titre principal du hero
  (« La baignade en bord de Marne, sur réservation. »), au titre de la
  section « Prêt à plonger ? » (carte `bg-brand-900`) et aux trois
  rubriques du pied de page (« Réserver », « Légal », « Contact »,
  fond `bg-slate-900`). Ressort vif sur fond bleu marine, contraste
  conservé pour l'accessibilité.

## [1.2.0] — 2026-05-19

### 🎨 Refonte design — direction institutionnelle & éditoriale

Objectif : « dé-IA-iser » l'interface, identité plus civique, micro-effets.

- **Fondations** : police de titres **Fraunces** (serif éditorial) +
  Inter corps ; palette/ombres/rayons affinés ; `prefers-reduced-motion`
  respecté ; `::selection`, focus soignés.
- **Micro-interactions** (zéro dépendance) : composant `<Reveal>`
  (apparition au scroll, IntersectionObserver), soulignés de liens
  animés (`.link-underline`), survol de cartes (`.card-hover`), retour
  tactile des boutons (press), apparition du hero (`fade-up` échelonné),
  **transition de prix** (`<AnimatedPrice>` — le total du tunnel pulse à
  chaque changement de quantité/code promo).
- **Fix** : `.claude/launch.json` → `runtimeExecutable: "npm"` (PATH,
  portable) au lieu d'un chemin absolu Intel cassé sur Apple Silicon
  (le serveur de dev/preview ne démarrait plus).
- **Page d'accueil** refondue : hero éditorial sobre (suppression de la
  fausse carte « Aujourd'hui », du badge à paillettes et des dégradés
  multi-stops), sections numérotées moins génériques, listes éditoriales.
- **En-tête** : logo aplati, navigation à soulignés animés, signature
  « Ville de Neuilly-sur-Marne ».
- **Emoji décoratifs retirés** de l'UI (📬 connexion/e-mail envoyé,
  👋 espace compte, 🏊‍♀️ sujet de campagne).
- Tout le back-office hérite des `.btn`/`.card`/typo affinés.

## [1.1.9] — 2026-05-19

### 🎟️ Codes de réduction

- Nouvelle table `discount_codes` (% ou montant fixe, usages max,
  période de validité, montant minimum) — migration
  `20260519200000_discount_codes.sql` (RLS admin).
- **Sécurité** : la remise est validée et appliquée **côté serveur**
  via la fonction `compute_discount()` (source unique de vérité) et le
  trigger `secure_reservation_insert` étendu — le client ne peut pas
  forcer une remise. Comptage des usages en `AFTER INSERT`.
- **Formulaire de réservation** : champ « Code de réduction » +
  bouton Appliquer (aperçu via RPC : ligne remise + nouveau total).
  Le serveur recalcule à l'identique.
- **Back-office `/admin/reductions`** : créer / activer-désactiver /
  supprimer des codes, suivi des usages. Entrée de menu + route lazy.

> ⚠️ Après merge : exécuter `20260519200000_discount_codes.sql`
> (SQL Editor) puis redéployer (rien à redéployer côté Edge — la
> logique est en base/trigger).

## [1.1.8] — 2026-05-19

### ✏️ E-mails automatiques éditables (back-office)

- Nouvelle table `email_templates` (5 modèles : confirmation, rappel
  J-1/H-1, fermeture météo, satisfaction) — migration
  `20260519100000_email_templates.sql` (RLS admin, seed par défaut).
- **Nouvelle page `/admin/emails`** : édition de l'objet + du corps via
  un **éditeur WYSIWYG** (zéro dépendance, contentEditable), aide
  variables, **aperçu live** dans le gabarit, « Réinitialiser au
  défaut ». Entrée de menu « E-mails auto ».
- `send-confirmation-email` : charge le modèle `confirmation` depuis la
  base, substitue les variables ({{prenom}}…), l'injecte dans un
  **gabarit sûr** (en-tête, QR, pied contrôlés par le code). Repli sur
  le défaut codé si la table est absente. Valeurs usager **échappées**
  (anti-injection HTML dans l'e-mail).
- Seul le **contenu** est éditable ; la structure e-mail reste non
  cassable.

> ⚠️ Après merge : exécuter `20260519100000_email_templates.sql`
> (SQL Editor) puis redéployer `send-confirmation-email`.

## [1.1.7] — 2026-05-19

### ✉️ E-mail de confirmation

- **Correctif affichage QR** : l'e-mail référençait `cid:qrcode` alors
  que le payload Brevo n'envoie qu'une pièce jointe simple → le QR ne
  s'affichait pas dans le corps. Désormais QR **intégré en data-URI**
  (rendu fiable sur la plupart des clients) **+ conservé en pièce
  jointe** (repli garanti) + mention « QR également en pièce jointe ».
- Domaine/expéditeur déjà alignés (`baignade@lesrivesdeparis.fr`,
  `https://baignade.lesrivesdeparis.fr`).

> ⚠️ Activation (hors code) : déclenché par `stripe-webhook` après
> paiement → nécessite **Stripe** configuré (compte mairie). Et l'envoi
> requiert **BREVO_API_KEY** + domaine `lesrivesdeparis.fr` **vérifié
> chez Brevo** + secrets `FROM_EMAIL`/`FROM_NAME`. Redéployer la
> fonction `send-confirmation-email` après merge.

## [1.1.6] — 2026-05-19

### 🛂 Contrôle d'accès — UX scan + aide

- **Scanner staff optimisé** : feedback **haptique (vibration)** +
  **bip distinct** OK / refus ; **reprise automatique du scan** après
  un accès valide (l'agent enchaîne sans toucher l'écran) ; anti
  double-scan du même QR ; résultat **plein écran** très lisible
  (vert / orange / rouge) ; **compteur d'entrées** de session ;
  légende couleurs sous le scanner. Les cas orange/rouge restent
  affichés jusqu'à action de l'agent.
- **Nouvelle rubrique d'aide back-office** (`/admin/aide`) : guide
  complet du scan (mise en place, signification des couleurs, tarif
  habitant & justificatif, dépannage caméra/rôle/réseau) + entrée de
  menu « Aide — Scan QR ».
- `scan-qr` appelé sans `scanned_by` côté client (identité dérivée du
  JWT côté serveur — cohérent avec le durcissement sécurité).

## [1.1.5] — 2026-05-17

### 🔍 Audit complet — remédiation

**Performance / temps de chargement**
- `sourcemap:false` en prod (−2,8 Mo, plus de fuite du code source),
  `manualChunks` (react/supabase isolés cachables), cible es2022.
- Code-splitting `lazy()`/`Suspense` (App.tsx) : bundle initial public
  ~222 ko gz → ~26 ko (shell) ; scanner QR/zxing et admin en chunks
  séparés, hors chemin public.
- Vidéo hero : rendue desktop only + hors `prefers-reduced-motion`,
  `preload="metadata"` ; cache `/*.mp4` (30 j) ; mobile garde le dégradé.
- `@stripe/stripe-js` retiré (inutilisé) ; fonts via `preconnect`+`link`
  (plus d'`@import` CSS render-blocking).

**Bugs / UX**
- Créneau non `open` ou complet → écran « non réservable », soumission
  bloquée (lien direct vers privé/fermé).
- `pending_payment` : message clair + bouton « Annuler la demande ».
- Annulation bloquée à moins de 24h ; message honnête (plus de promesse
  de remboursement automatique tant que Stripe n'est pas branché).
- Composition adultes/enfants conservée au retour du lien magique.
- Back-office créneaux : boutons Modifier / Dupliquer fonctionnels.
- États d'erreur réseau explicites (espace compte, détail réservation,
  réservations admin, historique scans, tableau de bord).
- Tableau de bord : taux de remplissage **calculé** (vue
  `slot_availability`) ; graphes statiques marqués « données
  illustratives » ; code mort retiré.

> Bug « -50 % enfant » volontairement non traité (exclu sur demande).
> Sécurité critique (escalade privilège / fraude tarifaire) : voir
> migration `20260519000000_harden_rls.sql` (PR dédiée).

### 🏊 Modèle opérationnel réel — Phase 1 (saison 2026)

Modèle confirmé par la commune le 2026-05-17.

- `supabase/season_2026.sql` : génération des créneaux réels de la saison
  **4 juillet → 30 août 2026** (idempotent, tag `SAISON2026`) :
  - Semaine : 10h–11h **privé** (cours natation + centres loisir, non
    public) · 11h–12h **public 1 € pour tous** · 12h–14h / 14h–16h /
    16h–18h public 5 € · nocéen 2 €.
  - Week-end : 10h–12h / 12h–14h / 14h–16h / 16h–18h / 18h–20h, tout
    public, 5 € · nocéen 2 € (aucun créneau 1 €).
  - Capacité 200 / créneau (provisoire).
- **Réservation — créneau à tarif unique** : l'option « tarif habitant »
  (et l'upload du justificatif + l'attestation) n'est désormais proposée
  que si le tarif résident est une **vraie réduction** (`< extérieur`).
  Sur le créneau 1 € pour tous, l'option habitant est masquée (plus de
  friction justificatif inutile).
- **Tarif enfant = tarif adulte** : suppression de la réduction enfant
  −50 % codée en dur (la commune n'a pas défini de tarif enfant/groupe ;
  champs adultes/enfants conservés pour une activation ultérieure sans
  refonte).

### 🐛 Correctifs back-office

- **Équipe** : le bouton « Inviter un membre » était inactif. Il ouvre
  désormais une fenêtre (e-mail + rôle) qui attribue le rôle au profil
  correspondant ; message clair si la personne ne s'est pas encore
  connectée via le lien magique.
- **Créneaux** : les statuts `private` / `archived` s'affichaient en
  anglais (valeur brute). Libellés français : « Privé (cours / loisirs) »,
  « Archivé ». Le bouton ouvrir/fermer est masqué pour ces statuts (évite
  d'ouvrir au public un créneau réservé aux cours).
- **Créneaux** : les tarifs étaient saisis en **centimes**. Les champs
  (création unitaire + génération en masse) sont désormais en **euros**
  (pas de 0,50 €), convertis en centimes à l'enregistrement.

### 🎬 Hero

- Vidéo de fond sur le hero de la page d'accueil (auto-hébergée
  `public/hero-baignade.mp4`, source : site officiel de la commune).
  Lecture auto, muette, en boucle ; voile dégradé pour la lisibilité du
  texte ; dégradé conservé en fallback.

### Phase 2 (différée, non bloquante)
- Module d'inscription en ligne aux cours de natation (groupes d'âge
  6–9 / 10–14, cohortes de 6, alternance 3×/sem sur 2 semaines, nocéens).

## [1.1.4] — 2026-05-17

### ✨ Tarif habitant / enfant configurable en back-office

- `AdminSlots` : la création de créneaux (à l'unité **et** génération en
  masse) expose désormais **Tarif extérieur / Tarif habitant / Tarif
  enfant** (en centimes). Avant : seul le tarif extérieur était saisi,
  le tarif habitant reposait sur le défaut SQL (300 ct) sans contrôle
  possible par la commune.
- Tableau des créneaux : la colonne « Tarif » affiche aussi le tarif
  habitant (`· hab. X €`) quand il est > 0.
- Rappel UX : tarif habitant à 0 → l'option « habitant » (et donc
  l'upload du justificatif + la case sur l'honneur) est masquée côté
  usager pour ce créneau.
- `supabase/demo/04_test_resident_slot.sql` : créneau de test avec tarif
  habitant > 0 (daté J+7) pour valider le formulaire usager
  (upload justificatif + déclaration sur l'honneur).

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
