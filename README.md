# 🏊‍♀️ Baignade Rives d'Paris

Application web de réservation pour la zone de baignade estivale de la **Commune de Neuilly-sur-Marne**.

**Stack** : Vite 6 · React 18 · TypeScript · Tailwind · Supabase (Postgres + Auth Magic Link + Edge Functions Deno) · Stripe Checkout · Brevo · Netlify.

🌐 **Site en ligne** : https://baignade.lesrivesdeparis.fr

---

## 📖 Documentation

| Fichier | Quand le lire |
|---|---|
| **[HANDOFF.md](HANDOFF.md)** | **À LIRE EN PRIORITÉ.** État du projet, comptes, credentials, comment reprendre depuis une nouvelle machine, tâches restantes |
| **[DEPLOY.md](DEPLOY.md)** | Runbook complet de déploiement (Supabase, Brevo, Stripe, Netlify) |
| **[CHANGELOG.md](CHANGELOG.md)** | Historique des versions |

---

## 🚀 Démarrage rapide

```bash
git clone https://github.com/conciliumdigital/baignade-rivesdaparis.git
cd baignade-rivesdaparis
npm install

# Créer .env.local avec les clés (voir HANDOFF.md section 3.2)
cp .env.example .env.local
# Compléter avec :
#   VITE_SUPABASE_URL=https://nunglkeqekxzpmushxty.supabase.co
#   VITE_SUPABASE_ANON_KEY=sb_publishable_XHasVadnhVZMoispGMq3aA_GdZEs8xy
#   VITE_APP_URL=http://localhost:5173

npm run dev
# → http://localhost:5173
```

Sans `.env.local`, l'app tourne en **mode démo** (créneaux fictifs, pas de persistance) — utile pour démos UI offline.

---

## 📁 Structure

```
src/
├── components/        # Header, Footer, CookieBanner, RequireAuth
├── layouts/           # PublicLayout, AdminLayout
├── pages/             # Pages publiques + admin/ + staff/
├── lib/               # supabase.ts, auth.tsx, format.ts, slots.ts
├── types/             # Types alignés avec le schéma Postgres
└── version.ts         # APP_VERSION (bumpée à chaque push prod)

supabase/
├── migrations/        # Schéma SQL versionné
└── functions/         # 4 Edge Functions Deno (Stripe, scan QR, email)

public/                # robots.txt, sitemap.xml, _headers, favicon.svg
```

---

## ✅ Fonctionnalités livrées

### Public
- Landing SEO (Open Graph, sitemap, robots)
- Calendrier des créneaux temps réel
- Réservation 1-6 personnes (adultes/enfants)
- Authentification **Magic Link** (Supabase Auth)
- **Paiement Stripe Checkout** (CB / Apple Pay / Google Pay) ⏳ *à brancher quand client prêt*
- Confirmation + **QR code** + email transactionnel (Brevo)
- Pages légales : CGU, Confidentialité, Mentions légales, Accessibilité
- Bandeau cookies RGPD

### Espace utilisateur
- Mes réservations + QR téléchargeable
- Annulation (jusqu'à J-1)
- Profil + préférences notifications
- **Suppression compte RGPD** (droit à l'oubli)

### Back-office admin (7 écrans)
Tableau de bord · Créneaux (CRUD + génération en masse) · Réservations (filtres + export CSV) · Communication (templates + segments) · Satisfaction (NPS) · Équipe · Paramètres

### Staff mobile-first
Scanner QR caméra · Validation visuelle vert/orange/rouge < 1s · Bip sonore · Anti-réutilisation · Historique scans

### Backend
9 tables · 1 view · RLS active partout · 4 Edge Functions Deno · Triggers anti-overbooking, auto-profile, updated_at

---

## 🔒 Sécurité & RGPD

- Hébergement données **UE (Frankfurt)** — Supabase
- Hébergement emails **France (Paris)** — Brevo
- Hébergement front **CDN mondial avec PoPs européens** — Netlify
- Cookies strictement nécessaires (banner)
- Pas de tracking tiers
- Droit à l'oubli en 1 clic
- Headers sécurité : HSTS, X-Frame-Options, Permissions-Policy
- RLS (Row Level Security) Supabase

---

## 🛠 Workflow de mise à jour

Voir **[HANDOFF.md section 6](HANDOFF.md#6-workflow-de-développement)** pour le détail.

```bash
# 1. Travailler localement
npm run dev
npm run build  # vérifier que le build passe

# 2. Bumper version (à chaque push prod)
# - src/version.ts → APP_VERSION
# - package.json → "version"
# - CHANGELOG.md → nouvelle entrée

# 3. Commit + push
git add . && git commit -m "feat: …" && git push origin main
# → Netlify auto-redéploie en ~1-2 min
```

---

## 💰 Coût

**0 €/mois** en plan free (Netlify Free + Supabase Free + Brevo Free). Coût variable : commission Stripe ~1,4 % + 0,25 € par réservation.

---

## 📞 Support

- **Prestataire** : CONCILIUM (Thomas Kolbe)
- **Repo** : https://github.com/conciliumdigital/baignade-rivesdaparis
- **Issues** : https://github.com/conciliumdigital/baignade-rivesdaparis/issues

---

Conçu par **CONCILIUM** pour la **Commune de Neuilly-sur-Marne** · 2026.
