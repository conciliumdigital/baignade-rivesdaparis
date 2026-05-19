# 🏊‍♀️ HANDOFF — Baignade Rives d'Paris

> Document de reprise du projet. Tout ce qu'il faut savoir pour continuer depuis une nouvelle machine, un nouveau collaborateur, ou après une pause.

**Version** : 1.1.6
**Dernière mise à jour** : 2026-05-19
**Client** : Commune de Neuilly-sur-Marne
**Prestataire** : CONCILIUM
**Statut** : ✅ En ligne sur Netlify, domaine https://baignade.lesrivesdeparis.fr (mode pré-production, Stripe en attente du client)

> ℹ️ Hébergement front migré de Cloudflare (Workers Assets) vers **Netlify** le 2026-05-17. Cloudflare totalement abandonné.

---

## 1. État actuel — Quick-look

| Composant | Statut | URL / Référence |
|---|---|---|
| **Site en ligne** | ✅ Online | https://baignade.lesrivesdeparis.fr |
| **Domaine custom** | ✅ Fait | `baignade.lesrivesdeparis.fr` (CNAME OVH `baignade` → `exquisite-sable-8f9d45.netlify.app`, SSL Let's Encrypt actif) |
| **Code source GitHub** | ✅ | https://github.com/conciliumdigital/baignade-rivesdaparis (public) |
| **Hosting front** | ✅ | Netlify (auto-deploy sur push `main`, config `netlify.toml`) |
| **Backend Supabase** | ✅ Frankfurt | Project ref : `nunglkeqekxzpmushxty` |
| **Auth Magic Link** | ✅ Activé | Email via SMTP Supabase par défaut |
| **Schéma SQL** | ✅ Appliqué | 9 tables, 1 view, RLS active |
| **Edge Functions** | ✅ 4 déployées | `create-checkout-session`, `stripe-webhook`, `scan-qr`, `send-confirmation-email` |
| **Emails transactionnels** | ✅ Brevo configuré | 🇫🇷 Paris, 300 mails/jour gratuits |
| **Vérification domaine Brevo** | ⏳ À finaliser | DNS TXT (SPF + DKIM + Brevo code) à ajouter chez le registrar |
| **Paiement Stripe** | ⏳ En attente | Client doit créer son compte commune |
| **Coût mensuel actuel** | **0 €/mois** | — |

---

## 2. Comptes & accès

### 2.1 Comptes utilisés

| Service | Compte | URL admin |
|---|---|---|
| **Supabase** | `baignade-rivesdaparis@tk7.fr` | https://supabase.com/dashboard/project/nunglkeqekxzpmushxty |
| **GitHub** | `conciliumdigital` | https://github.com/conciliumdigital/baignade-rivesdaparis |
| **Netlify** | (à compléter) | https://app.netlify.com — site `exquisite-sable-8f9d45` |
| **Brevo** | `baignade-rivesdaparis@tk7.fr` | https://app.brevo.com |
| **Stripe** | ⏳ à créer par le client (Mairie) | https://dashboard.stripe.com |
| **DNS `lesrivesdeparis.fr`** | OVH | Zone DNS 100 % chez OVH — CNAME `baignade` → `exquisite-sable-8f9d45.netlify.app` |

### 2.2 Secrets sensibles (à stocker dans Bitwarden / 1Password — NE JAMAIS commiter)

Voir le message de chat du 11/05/2026 ou ton gestionnaire de mots de passe.

À sauvegarder :
- Supabase **access token** (`sbp_...`) — pour la CLI/déploiement
- Supabase **service_role key** — pour les opérations admin
- Supabase **DB password** — généré à la création du projet
- **Brevo API key** (`xkeysib-...`)
- (À venir) Stripe **secret key**, **webhook secret**

### 2.3 Clés publiques (peuvent être versionnées dans la doc)

Ces clés sont par design exposables au public (côté front) — pas un secret :

```
SUPABASE_URL          = https://nunglkeqekxzpmushxty.supabase.co
SUPABASE_ANON_KEY     = sb_publishable_XHasVadnhVZMoispGMq3aA_GdZEs8xy
SUPABASE_PROJECT_REF  = nunglkeqekxzpmushxty
```

---

## 3. Reprendre le projet sur une nouvelle machine

### 3.1 Outils requis

```bash
# Node 20+
node --version  # >= v20

# Git
git --version

# Supabase CLI (binaire direct, brew bloqué par Xcode obsolète)
mkdir -p ~/.local/bin && cd ~/.local/bin
curl -sL https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz -o supabase.tar.gz
tar -xzf supabase.tar.gz && chmod +x supabase
~/.local/bin/supabase --version  # >= 2.98

# GitHub CLI (optionnel mais pratique)
brew install gh
gh auth login
```

### 3.2 Cloner et lancer

```bash
# Cloner le repo
gh repo clone conciliumdigital/baignade-rivesdaparis
cd baignade-rivesdaparis

# Installer dépendances
npm install

# Créer .env.local (NE PAS commiter)
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://nunglkeqekxzpmushxty.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_XHasVadnhVZMoispGMq3aA_GdZEs8xy
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=Baignade Rives d'Paris
EOF

# Lancer le dev server
npm run dev
# → http://localhost:5173
```

### 3.3 Re-lier la CLI Supabase (pour déployer Edge Functions)

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx  # depuis ton gestionnaire de mots de passe

# Déploiement direct par --project-ref (pas besoin de supabase link)
~/.local/bin/supabase functions deploy create-checkout-session --project-ref nunglkeqekxzpmushxty --no-verify-jwt
~/.local/bin/supabase functions deploy stripe-webhook --project-ref nunglkeqekxzpmushxty --no-verify-jwt
~/.local/bin/supabase functions deploy scan-qr --project-ref nunglkeqekxzpmushxty
~/.local/bin/supabase functions deploy send-confirmation-email --project-ref nunglkeqekxzpmushxty --no-verify-jwt

# Lister les secrets Supabase
~/.local/bin/supabase secrets list --project-ref nunglkeqekxzpmushxty

# Ajouter/modifier un secret
~/.local/bin/supabase secrets set --project-ref nunglkeqekxzpmushxty KEY=value
```

---

## 4. Architecture du projet

### 4.1 Stack

- **Front** : Vite 6 + React 18 + TypeScript + Tailwind 3 + React Router 6
- **Backend** : Supabase Frankfurt (PostgreSQL 17 + Auth Magic Link + Edge Functions Deno)
- **Hosting** : Netlify (auto-deploy sur push `main`, config `netlify.toml`)
- **Emails** : Brevo (FR, RGPD natif)
- **Paiement** : Stripe Checkout (à brancher)
- **QR codes** : génération via `qrcode` (PNG + dataURL), scan via `@yudiel/react-qr-scanner`

### 4.2 Structure des dossiers

```
baignade-rivesdaparis/
├── src/
│   ├── components/          # Header, Footer, CookieBanner, RequireAuth
│   ├── layouts/             # PublicLayout, AdminLayout
│   ├── pages/               # Pages publiques
│   │   ├── admin/           # 7 pages back-office
│   │   └── staff/           # Scanner QR + historique
│   ├── lib/                 # supabase.ts, auth.tsx, format.ts, slots.ts
│   ├── types/database.ts
│   ├── App.tsx              # Routing
│   ├── main.tsx
│   └── version.ts           # APP_VERSION (à bumper à chaque push prod)
├── public/                  # favicon, robots.txt, sitemap.xml, _headers
├── supabase/
│   ├── migrations/          # Schéma SQL versionné
│   └── functions/           # 4 Edge Functions Deno
├── .env.example             # Template
├── .env.local               # ⛔ gitignored
├── CHANGELOG.md             # à mettre à jour à chaque push prod
├── DEPLOY.md                # Runbook complet
├── HANDOFF.md               # Ce fichier
├── README.md
├── package.json             # version sync avec src/version.ts
├── tailwind.config.js
├── vite.config.ts
├── vercel.json              # config alternative
├── netlify.toml             # config alternative
├── Dockerfile               # config alternative (Scaleway/OVH)
└── nginx.conf
```

### 4.3 Schéma SQL — tables principales

- `profiles` — utilisateurs étendus (rôle, RGPD, notifs)
- `slots` — créneaux 2h, capacité, prix, statut
- `slot_availability` (view) — places restantes en temps réel
- `reservations` — résa avec QR token, statut, Stripe IDs
- `scan_log` — historique scans QR par le staff
- `waitlist` — liste d'attente
- `satisfaction_responses` — avis post-visite
- `email_campaigns` — communication ciblée
- `notification_log` — historique des emails envoyés
- `site_settings` — config dynamique de la commune

RLS active sur toutes les tables. Helpers `is_admin()` / `is_staff_or_admin()`.

### 4.4 Edge Functions

| Fonction | verify_jwt | Trigger | Rôle |
|---|---|---|---|
| `create-checkout-session` | ❌ | front | Crée une session Stripe Checkout |
| `stripe-webhook` | ❌ | Stripe | Réceptionne paiement → génère QR token → trigger email |
| `scan-qr` | ✅ | staff app | Valide QR + marque utilisé + journalise |
| `send-confirmation-email` | ❌ | autre function | Envoie mail conf via Brevo avec QR en pièce jointe |

---

## 5. Tâches restantes pour passer en production

### 5.1 ⏳ À faire (par toi)

- [x] ✅ **Domaine `baignade.lesrivesdeparis.fr` en ligne** — FAIT
  - Hébergement Netlify, domaine ajouté dans Netlify → Domain management
  - Zone DNS 100 % chez **OVH** : un seul `CNAME` `baignade` → `exquisite-sable-8f9d45.netlify.app`
  - SSL Let's Encrypt provisionné automatiquement par Netlify (actif et valide)
  - URL Netlify directe (technique, tests) : https://exquisite-sable-8f9d45.netlify.app
  - `APP_URL` côté Supabase à aligner si besoin :
    ```bash
    export SUPABASE_ACCESS_TOKEN=sbp_xxx
    ~/.local/bin/supabase secrets set --project-ref nunglkeqekxzpmushxty APP_URL=https://baignade.lesrivesdeparis.fr
    ```
  - Env vars front : Netlify → Site configuration → Environment variables (les 2 seules lues par le code sont `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`)

- [ ] **Finaliser la vérification du domaine Brevo**
  - https://app.brevo.com → Senders & IPs → Domains → cliquer **Authenticate** sur `lesrivesdeparis.fr`
  - Vérifier que les 3 enregistrements TXT sont bien dans le DNS
  - Une fois "Verified", les emails de confirmation partiront correctement

- [ ] **Créer un compte admin dans Supabase**
  - SQL Editor → exécuter :
    ```sql
    update profiles set role = 'admin' where email = 'ton.email@admin.fr';
    ```
  - (Tu dois d'abord t'être connecté une fois via Magic Link pour que le profil soit auto-créé par le trigger)

- [ ] **Générer les créneaux pour la saison**
  - Via le back-office : `/admin/creneaux` → **Génération en masse**
  - Ou via SQL :
    ```sql
    insert into slots (date, start_time, end_time, capacity, price_cents, status)
    select
      d::date,
      t::time,
      (t::time + interval '2 hours')::time,
      50,
      500,
      'open'
    from generate_series('2026-07-01'::date, '2026-08-31'::date, '1 day') d,
         (values ('10:00'), ('12:00'), ('14:00'), ('16:00'), ('18:00')) ts(t)
    on conflict do nothing;
    ```

### 5.2 ⏳ En attente du client (Mairie de Neuilly-sur-Marne)

- [ ] **Création du compte Stripe au nom de la commune** (SIRET, RIB, justificatifs)
- [ ] **Validation juridique** par la mairie des CGU, mentions légales, politique de confidentialité
- [ ] **Notification du DPO** + mise à jour du registre des traitements RGPD
- [ ] **Accès Google Search Console** pour soumettre le sitemap

### 5.3 ⚙️ Quand Stripe est prêt (5 min de manip côté toi)

1. Récupérer auprès du client : `pk_live_*`, `sk_live_*`, créer le webhook et récupérer `whsec_*`
2. Pousser les secrets côté Supabase :
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_xxx
   ~/.local/bin/supabase secrets set --project-ref nunglkeqekxzpmushxty \
     STRIPE_SECRET_KEY=sk_live_xxx \
     STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
3. Ajouter dans Netlify → Site configuration → Environment variables :
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx`
4. Push un commit (même trivial) → Netlify re-déploie (~1-2 min) → c'est en ligne avec paiement actif

---

## 6. Workflow de développement

### 6.1 Modifications quotidiennes

```bash
# Travailler en local
npm run dev

# Vérifier que ça build avant de pousser
npm run build

# Bumper la version (mémoire utilisateur : Changelog + Footer à chaque push prod)
# - src/version.ts → APP_VERSION = "1.0.2"
# - package.json → "version": "1.0.2"
# - CHANGELOG.md → nouvelle entrée datée

git add .
git commit -m "feat|fix|chore: …"
git push origin main
# → Netlify auto-redéploie en ~1-2 min
```

### 6.2 Modifier une Edge Function

```bash
# Éditer le fichier dans supabase/functions/<name>/index.ts
# Puis déployer :
export SUPABASE_ACCESS_TOKEN=sbp_xxx
~/.local/bin/supabase functions deploy <name> --project-ref nunglkeqekxzpmushxty [--no-verify-jwt]
```

### 6.3 Modifier le schéma SQL

```bash
# Créer une nouvelle migration
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# L'écrire, puis l'appliquer :
# Option A — copier-coller dans SQL Editor du dashboard Supabase
# Option B — via la CLI (nécessite db push + DB password)
~/.local/bin/supabase db push --project-ref nunglkeqekxzpmushxty
```

---

## 7. Tests bout-en-bout

### 7.1 Parcours utilisateur complet

1. Aller sur `https://baignade.lesrivesdeparis.fr/`
2. Cliquer "Réserver" → choisir un créneau ouvert
3. Remplir le formulaire (1-6 personnes)
4. Cliquer "Payer" → ⚠️ erreur attendue tant que Stripe pas configuré
5. *(Quand Stripe configuré)* → redirect vers Stripe Checkout → carte test `4242 4242 4242 4242` exp `12/34` CVC `123`
6. Retour sur la page de confirmation avec QR code
7. Email reçu via Brevo (si domaine vérifié) avec QR en pièce jointe

### 7.2 Test admin

1. Se connecter via Magic Link (email reçu via SMTP Supabase)
2. Aller sur `/admin` — accessible si rôle `admin` ou `manager`
3. Onglets : Tableau de bord, Créneaux, Réservations, Communication, Satisfaction, Équipe, Paramètres

### 7.3 Test staff scanner

1. Avec un compte rôle `staff`, `admin` ou `manager`
2. Sur mobile : aller sur `/staff`
3. Autoriser l'accès caméra
4. Scanner un QR code valide → écran vert "Accès autorisé"
5. Scanner le même QR à nouveau → écran orange "Déjà utilisé"

---

## 8. Surveillance & support

| Outil | URL |
|---|---|
| Logs Netlify | https://app.netlify.com → site `exquisite-sable-8f9d45` → Deploys |
| Logs Edge Functions | https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/functions |
| Logs DB Supabase | https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/logs/postgres-logs |
| Délivrabilité Brevo | https://app.brevo.com → Statistics → Transactional |
| (Plus tard) Logs Stripe | https://dashboard.stripe.com/test/logs |

---

## 9. Si quelque chose casse

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche en prod | Env vars manquantes côté Netlify | Vérifier `VITE_*` dans Netlify → Site configuration → Environment variables |
| "Supabase non configuré" en console | Mode démo activé | Idem |
| Magic Link non reçu | Rate limit SMTP Supabase (3/h) | Attendre 1h ou configurer un SMTP custom dans Auth settings |
| Paiement échoue | Stripe pas branché | Voir section 5.3 |
| Email confirmation pas envoyé | Brevo : domaine non vérifié ou clé invalide | Logs Supabase → function `send-confirmation-email` |
| Webhook Stripe en erreur | Mauvais URL ou secret | Stripe Dashboard → Webhooks → onglet "Logs" |
| QR scan refuse tous les codes | Edge Function `scan-qr` pas déployée ou rôle staff manquant | Vérifier la function + `profiles.role` du scanner |
| Projet Supabase en pause (free tier) | 7 jours sans activité | Dashboard Supabase → "Restore project" (1 clic) |

---

## 10. Liens utiles

- 📖 **Cahier des charges** : conservé séparément
- 🌐 **Site prod** : https://baignade.lesrivesdeparis.fr
- 🌐 **URL Netlify directe** (tests) : https://exquisite-sable-8f9d45.netlify.app
- 💻 **Code source** : https://github.com/conciliumdigital/baignade-rivesdaparis
- 📋 **Issues / TODO** : https://github.com/conciliumdigital/baignade-rivesdaparis/issues
- 📖 **DEPLOY.md** : runbook complet de déploiement
- 📖 **CHANGELOG.md** : historique versions
- 🇫🇷 **Brevo** : https://app.brevo.com
- 🟦 **Supabase** : https://supabase.com/dashboard/project/nunglkeqekxzpmushxty
- 🟩 **Netlify** : https://app.netlify.com (site `exquisite-sable-8f9d45`)

---

## 11. Contacts

- **Prestataire** : CONCILIUM (Thomas Kolbe)
- **Client** : Mairie de Neuilly-sur-Marne
- **DPO Mairie** : `dpo@neuillysurmarne.fr`
- **Email service** : `baignade@neuillysurmarne.fr` (ou similaire à confirmer)

---

> 🤖 Document maintenu manuellement. Si tu modifies l'architecture, les comptes ou les credentials, **mets ce fichier à jour**.
