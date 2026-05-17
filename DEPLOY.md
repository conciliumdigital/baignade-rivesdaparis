# 🚀 Mise en ligne — baignade.lesrivesdeparis.fr

> **Stack budget zéro** : 0 €/mois fixes pour héberger le service. Tu ne payes que les commissions Stripe sur les réservations effectives.

---

## 💰 Récap budget

| Service | Plan | Coût | Limite gratuite |
|---|---|---|---|
| **Cloudflare Pages** | Free | 0 € | Bandwidth illimité, builds illimités |
| **Supabase** Free (Frankfurt) | Free | 0 € | 500 MB DB, 50 000 utilisateurs/mois, 500 k Edge Functions |
| **Brevo** 🇫🇷 (emails) | Free | 0 € | 300 emails/jour |
| **Stripe** | Standard | 0 € | Commission 1,4 % + 0,25 €/transaction |
| **Domaine** `lesrivesdeparis.fr` | déjà acquis | 0 € | — |
| **Total fixe** | | **0 €/mois** | |

⚠️ **À savoir** : Supabase Free met le projet en pause après 7 jours sans activité. Hors saison de baignade, il suffit de cliquer sur "Restore" pour le réveiller. Pour passer en illimité, le plan Pro est à 25 $/mois — mais inutile pour démarrer.

📈 **Quand passer en payant ?** Si la commune approche 50 000 réservations/mois (peu probable) ou veut un projet jamais mis en pause hors saison, basculer Supabase en Pro. Le reste reste gratuit.

---

## ⚡ TL;DR — ordre de bataille (1 h 30 chrono)

1. **Supabase** : créer le projet UE → appliquer le schéma → récupérer URL + anon key — *15 min*
2. **Brevo** : compte → vérifier le domaine `lesrivesdeparis.fr` → API key — *15 min*
3. **Stripe** : compte → clés → webhook — *15 min*
4. **GitHub** : push du code — *5 min*
5. **Cloudflare Pages** : connect GitHub → déployer avec 4 env vars — *10 min*
6. **Edge Functions Supabase** : `supabase functions deploy` ×4 — *10 min*
7. **DNS** : pointer `baignade.lesrivesdeparis.fr` vers Cloudflare — *5 min*
8. **Test bout-en-bout** : réserver → payer (carte test) → recevoir le QR → scanner — *15 min*

---

## 1. Supabase (15 min)

### a) Créer le projet
1. https://supabase.com → "Start your project" → connect GitHub
2. New project :
   - **Region : Frankfurt (eu-central-1)** ← obligatoire pour le RGPD
   - Plan : **Free**
   - Mot de passe DB fort (à conserver dans un gestionnaire)

### b) Appliquer le schéma
**Méthode rapide** : SQL Editor → New query → coller le contenu de `supabase/migrations/20260505000000_initial_schema.sql` → Run.

Ou via la CLI :
```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-ref>
supabase db push
```

### c) Activer le Magic Link
Authentication → Providers → Email :
- ✅ Enable Email provider
- ❌ Confirm email (décocher — Magic Link suffit)
- ✅ Magic link

Authentication → Email Templates → "Magic Link" : personnaliser en FR. Exemple :
```
Sujet : Connexion à Baignade Rives d'Paris
Bonjour,
Cliquez sur ce lien pour vous connecter en toute sécurité :
{{ .ConfirmationURL }}
Ce lien expire dans 1 heure.
```

### d) Créer le premier admin
SQL Editor (remplacer l'email) :
```sql
update profiles set role = 'admin' where email = 'admin@neuillysurmarne.fr';
```

### e) Noter les clés
Settings → API :
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` → `VITE_SUPABASE_ANON_KEY`
- `service_role` → secret côté serveur uniquement (Edge Functions)

---

## 2. Brevo — emails transactionnels (15 min)

[Brevo (ex-Sendinblue)](https://www.brevo.com/fr/) est une entreprise française basée à Paris, RGPD natif, 300 emails/jour gratuits — largement suffisant.

1. https://www.brevo.com/fr/ → Inscription gratuite
2. Senders & IPs → Domains → Ajouter `lesrivesdeparis.fr`
3. Suivre les instructions DNS : ajouter chez ton registrar les enregistrements **SPF**, **DKIM** et **Brevo code** (TXT). Cela authentifie tes envois et évite les spams.
4. SMTP & API → API Keys → "Generate a new API key" → copier → ce sera `BREVO_API_KEY`

Tu peux aussi configurer l'email d'expédition par défaut : `baignade@lesrivesdeparis.fr` (à créer chez ton registrar avec une redirection vers la boîte de la commune).

---

## 3. Stripe (15 min)

### a) Compte business commune
1. https://dashboard.stripe.com/register → "Business account"
2. Renseigner les infos commune (SIRET, RIB, justificatifs)
3. **Mode test** d'abord — l'activation live prend 1-3 jours côté Stripe

### b) Moyens de paiement
Settings → Payment methods → activer : **Card**, **Apple Pay**, **Google Pay**, **Link** (optionnel).

### c) Clés API
Developers → API keys :
- **Publishable key** (`pk_test_…` puis `pk_live_…`) → `VITE_STRIPE_PUBLISHABLE_KEY`
- **Secret key** (`sk_test_…`) → secret Edge Function uniquement (jamais dans le front !)

### d) Webhook
Developers → Webhooks → Add endpoint :
- Endpoint URL : `https://<votre-projet>.supabase.co/functions/v1/stripe-webhook`
- Events :
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `refund.created`
- Copier le **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`

---

## 4. GitHub (5 min)

```bash
cd "Baignade RDP"
git init
git add .
git commit -m "feat: MVP initial baignade.lesrivesdeparis.fr v1.0.0"
git branch -M main
gh repo create baignade-rivesdaparis --public --source=. --push
# ou manuellement :
# git remote add origin git@github.com:<org>/baignade-rivesdaparis.git
# git push -u origin main
```

---

## 5. Cloudflare Pages (10 min)

1. https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
2. Sélectionner le repo `baignade-rivesdaparis`
3. **Build settings** :
   - Framework preset : **Vite**
   - Build command : `npm run build`
   - Output directory : `dist`
   - Root directory (si monorepo) : `Baignade RDP`
4. **Environment variables** (Production) :
   - `VITE_SUPABASE_URL` = `https://xxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
   - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_xxx`
   - `VITE_APP_URL` = `https://baignade.lesrivesdeparis.fr`
5. Save and Deploy

Cloudflare construit le site (~2 min), SSL inclus, URL temporaire `*.pages.dev`.

---

## 6. Déploiement des Edge Functions Supabase (10 min)

```bash
cd "Baignade RDP"

# Définir les secrets côté Supabase (jamais commit !)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set BREVO_API_KEY=xkeysib-xxx
supabase secrets set APP_URL=https://baignade.lesrivesdeparis.fr
supabase secrets set FROM_EMAIL=baignade@lesrivesdeparis.fr
supabase secrets set FROM_NAME="Baignade Rives d'Paris"

# Déployer les 4 functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy scan-qr
supabase functions deploy send-confirmation-email --no-verify-jwt
```

> `--no-verify-jwt` sur `stripe-webhook` et `send-confirmation-email` : ces fonctions sont appelées par Stripe et par d'autres functions, pas par l'utilisateur final.

---

## 7. DNS — pointer le domaine (5 min)

Dans le dashboard Cloudflare Pages :
- Custom domains → Set up a custom domain → `baignade.lesrivesdeparis.fr`
- Cloudflare affiche un CNAME à ajouter chez le registrar de `lesrivesdeparis.fr`

Chez le registrar :
```
Type    Nom         Valeur                          TTL
CNAME   baignade    <project>.pages.dev.            3600
```

Propagation DNS : 5 min à 24 h selon les FAI. Cloudflare émet le certificat HTTPS Let's Encrypt automatiquement.

---

## 8. Test bout-en-bout (15 min)

1. Aller sur `https://baignade.lesrivesdeparis.fr/` — la landing doit s'afficher
2. **Admin** : se connecter avec l'email admin → Magic Link reçu (Brevo) → admin
3. **Créer un créneau** : Admin → Créneaux → Génération en masse pour aujourd'hui
4. **Réserver côté public** : aller sur `/reserver` → sélectionner → payer avec carte test `4242 4242 4242 4242` (CVC 123, date future)
5. **Vérifier l'email** : QR code reçu en pièce jointe
6. **Scanner** : `/staff` → présenter le QR à la caméra → écran vert "Accès autorisé"

Si tout fonctionne : **bascule Stripe en live**, recopie les nouvelles clés dans les env vars, redéploie.

---

## ✅ Checklist pré-prod

- [ ] Supabase région Frankfurt confirmée
- [ ] Backups Supabase Free actifs (7 jours rétention)
- [ ] RLS active sur toutes les tables (déjà fait dans le schéma)
- [ ] Brevo domaine `lesrivesdeparis.fr` **Verified**
- [ ] Stripe en **mode live** avec compte commune validé
- [ ] Webhook Stripe testé (Developers → Webhooks → Send test event)
- [ ] Au moins 1 compte admin créé
- [ ] Créneaux générés pour juillet-août
- [ ] **CGU, Mentions légales, Confidentialité revues juridiquement** par la commune et le DPO
- [ ] Registre des traitements RGPD mis à jour
- [ ] sitemap.xml soumis à Google Search Console
- [ ] Google Business Profile mis à jour
- [ ] Audit Lighthouse > 90 (performance + accessibilité)
- [ ] Compte staff créé pour chaque MNS/agent d'accueil

---

## 🔄 Mises à jour futures

Workflow standard :
```bash
# 1. Bumper version (mémoire utilisateur Thomas : Changelog + Footer version à chaque push prod)
# - src/version.ts → APP_VERSION = "1.0.1"
# - CHANGELOG.md → nouvelle entrée datée
# - package.json → "version"

git add .
git commit -m "fix: …" # ou feat:/chore:
git push origin main
# → Cloudflare Pages auto-redeploy en ~2 min
```

Pour les Edge Functions :
```bash
supabase functions deploy <function-name>
```

---

## 🆘 Si quelque chose casse

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche | Env vars manquantes | Vérifier les `VITE_*` dans Cloudflare Pages → Settings → Environment variables |
| "Supabase non configuré" en console | Mode démo actif | Idem |
| Paiement OK mais pas d'email | Brevo key incorrecte ou domaine non vérifié | Logs Supabase Functions + tableau de bord Brevo |
| Webhook Stripe en erreur | Mauvaise URL ou secret | Stripe Dashboard → Webhooks → onglet "Logs" |
| QR scan refuse tous les codes | Edge Function `scan-qr` pas déployée | `supabase functions deploy scan-qr` |
| Projet Supabase en pause | 7 jours sans activité (free tier) | Dashboard Supabase → bouton "Restore project" |

---

## 🇫🇷 Alternative 100 % souveraine française (~10 €/mois)

Si la commune préfère héberger en France au-delà du gratuit :

| Composant | Service FR | Coût |
|---|---|---|
| Front | **Scaleway Object Storage** + CDN | ~1 €/mois |
| Base + Auth + Functions | **Supabase Pro** Frankfurt (compute dédié, jamais en pause) | 25 $/mois |
| Emails | **Brevo Lite** (20k emails/mois) | 19 €/mois |
| Paiement | Stripe (idem) ou **PayPlug** 🇫🇷 | commission |

Le Dockerfile et `nginx.conf` du projet sont prêts pour Scaleway Serverless Containers (région PAR), Clever Cloud ou OVH si tu veux pousser plus loin la souveraineté.

---

## Support

- 📖 Doc Supabase : https://supabase.com/docs
- 📖 Doc Stripe Checkout : https://stripe.com/docs/checkout
- 📖 Doc Brevo API : https://developers.brevo.com/
- 📖 Doc Cloudflare Pages : https://developers.cloudflare.com/pages/
- 🇫🇷 DPO Mairie : `dpo@neuillysurmarne.fr`
