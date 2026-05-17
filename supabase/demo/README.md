# 🎬 Démo client — Baignade Rives d'Paris

Contenu et scénario pour présenter l'outil à la Mairie de Neuilly-sur-Marne.

Site de démonstration : **https://baignade.lesrivesdeparis.fr**

---

## 1. Préparation (à faire avant le rendez-vous)

Exécuter dans le SQL Editor Supabase
(<https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new>), dans l'ordre :

| Étape | Fichier | Rôle | Risque |
|---|---|---|---|
| 1 | `01_seed_slots.sql` | Créneaux 6–19 juillet 2026 (calendrier public) | Sûr |
| 2 | `02_seed_backoffice.sql` | Usagers + réservations + avis (tableau de bord) | Optionnel |
| — | `99_cleanup_demo.sql` | Purge tout le contenu de démo | À lancer après la démo |

> Le seul fichier indispensable est `01`. Le `02` enrichit le back-office
> mais touche `auth.users` : à lancer une fois, puis `99` pour rejouer.

**Compte administrateur de démo** (créé par `02`) :
`demo.admin@demo.lesrivesdeparis.fr` — mot de passe `DemoBaignade2026!`
(rôles également disponibles : `demo.manager@…`, `demo.agent@…` pour le scan).
Les usagers de démo : `demo.martin@…` (habitant), `demo.petit@…` (extérieur).

> ℹ️ Si la connexion par mot de passe n'est pas activée, utilisez votre
> compte admin réel (Magic Link + `update profiles set role='admin'…`).

---

## 2. Scénario de présentation (≈ 12 min)

### Acte 1 — Le parcours usager (≈ 5 min)
1. **Page d'accueil** `/` — positionnement, identité commune, accès mobile.
2. **Calendrier** `/reserver` — créneaux en temps réel, places restantes,
   un créneau **fermé pour météo** (le 9 juillet 10h) → montrer la gestion
   des aléas.
3. **Tunnel de réservation** — choisir un créneau, 1–6 personnes.
   - Bascule **tarif habitant Neuilly** (3 € au lieu de 5 €) → apparition
     de l'**upload de justificatif** + **déclaration sur l'honneur**.
   - Tarif extérieur → pas de justificatif. *Argument : recettes maîtrisées,
     contrôle souple, conformité.*
4. **Connexion sans mot de passe** (Magic Link) — RGPD, zéro friction.
5. **Espace usager** `/compte` — réservations, QR code, annulation J-1.

### Acte 2 — Le back-office commune (≈ 5 min)
Se connecter en admin, aller sur `/admin`.
1. **Tableau de bord** — réservations, **recettes saison**, taux de no-show,
   **note moyenne de satisfaction**, créneaux à venir (chiffres alimentés
   par le seed).
2. **Créneaux** `/admin/creneaux` — génération en masse saisonnière,
   ouverture/fermeture rapide (météo).
3. **Réservations** `/admin/reservations` — recherche, filtres, **badge
   tarif habitant + justificatif (lien sécurisé)**, export CSV.
4. **Satisfaction** `/admin/satisfaction` — note moyenne, NPS, verbatims.
5. **Communication / Équipe / Paramètres** — survol rapide.

### Acte 3 — Le terrain (≈ 2 min)
1. `/staff` sur mobile (compte `demo.agent@…`).
2. Scanner un QR (réservation `DEMO-…`) → écran vert « Accès autorisé »,
   détail famille, badge habitant + justificatif.
3. Re-scanner → écran orange « Déjà utilisé » (anti-fraude).

---

## 3. Points forts à marteler

- **0 €/mois d'hébergement** — budget commune préservé.
- **RGPD natif** — données et e-mails en UE (Supabase Frankfurt, Brevo FR).
- **Tarif résident** différencié avec justificatif, sans contrôle lourd.
- **Anti-fraude** — QR usage unique, scan < 1 s.
- **Autonomie commune** — back-office complet, aucune dépendance presta
  au quotidien.
- **Accessibilité** RGAA, mobile-first.

---

## 4. Après la démo

- Lancer **`99_cleanup_demo.sql`** pour repartir d'une base propre avant
  la mise en service réelle.
- Vérifier que les 4 compteurs de contrôle renvoient `0`.

> ⚠️ Ne jamais laisser les données `DEMO` en production une fois le service
> ouvert au public.
