# Note technique de reprise — Baignade Rives d'Paris

> Snapshot technique à jour, destiné à la continuité du développement chez CONCILIUM.
> Pour l'historique détaillé et le runbook de déploiement, voir `HANDOFF.md`, `DEPLOY.md` et `CHANGELOG.md` à la racine du dépôt.

**Version applicative** : 1.4.2
**Date du snapshot** : 2026-05-29
**Client** : Mairie de Neuilly-sur-Marne
**Prestataire** : CONCILIUM (Thomas Kolbé)
**Statut** : en ligne sur https://baignade.lesrivesdeparis.fr (pré-production, ouverture publique visée le 4 juillet 2026)

---

## 1. Vue d'ensemble

| Composant | Statut | Référence |
|---|---|---|
| Site public | en ligne | https://baignade.lesrivesdeparis.fr |
| Code source | public | https://github.com/conciliumdigital/baignade-rivesdaparis (branche `main`) |
| Hébergement front | Netlify | site `exquisite-sable-8f9d45`, auto-deploy sur push `main` |
| Plan Netlify | Personal | depuis le 28/05/2026 (1000 crédits / mois) |
| Backend | Supabase | projet `nunglkeqekxzpmushxty` (Frankfurt, UE) |
| Authentification | Magic Link | sans mot de passe, via Supabase Auth |
| Edge Functions | 6 déployées | voir section 4 |
| E-mails | Brevo (FR) | fallback Resend, domaine à vérifier |
| Paiement | Stripe | non branché (compte à créer par la mairie) |
| Anti-pause Supabase | actif | GitHub Actions, 2 écritures / jour |

---

## 2. Stack technique

- **Front** : Vite 6, React 18, TypeScript 5.6, Tailwind 3, React Router 6.
- **Backend** : Supabase (PostgreSQL 17, Auth Magic Link, Storage, Edge Functions Deno).
- **E-mails** : Brevo prioritaire (RGPD, hébergement FR), Resend en repli automatique selon les variables d'environnement.
- **Paiement** : Stripe Checkout (intégration prête côté code, en attente du compte mairie).
- **Build** : code-splitting `lazy` / `Suspense`, bundle public initial autour de 26 ko gz, `sourcemap` désactivé en production.

---

## 3. Accès et ressources externes

| Service | Adresse | Compte |
|---|---|---|
| GitHub | https://github.com/conciliumdigital/baignade-rivesdaparis | owner `conciliumdigital` |
| Supabase | https://supabase.com/dashboard/project/nunglkeqekxzpmushxty | `baignade-rivesdaparis@tk7.fr` |
| Netlify | site `exquisite-sable-8f9d45` | compte CONCILIUM |
| Brevo | https://app.brevo.com | `baignade-rivesdaparis@tk7.fr` |
| Stripe | https://dashboard.stripe.com | à créer par la mairie |
| DNS | OVH (zone `lesrivesdeparis.fr`) | CNAME `baignade` vers `exquisite-sable-8f9d45.netlify.app` |

> Les secrets (clés API, service role) sont conservés dans le gestionnaire de mots de passe de Thomas. Aucun secret n'est commité dans le dépôt.

---

## 4. Edge Functions

| Fonction | Rôle | Déploiement |
|---|---|---|
| `scan-qr` | Validation des entrées (identité et rôle dérivés du JWT) | SANS `--no-verify-jwt` |
| `create-checkout-session` | Création d'une session Stripe Checkout | avec `--no-verify-jwt` |
| `stripe-webhook` | Réception `checkout.session.completed`, déclenche la confirmation | avec `--no-verify-jwt` |
| `send-confirmation-email` | E-mail de confirmation avec QR code (modèle éditable + gabarit sûr) | avec `--no-verify-jwt` |
| `send-reminders` | Enfile les rappels J-1 et H-1 dans `notification_log` | avec `--no-verify-jwt` |
| `process-notifications` | Worker générique qui dépile `notification_log` (closure, rappels, liste d'attente) | avec `--no-verify-jwt` |

> Règle critique : `scan-qr` repose sur la vérification JWT pour son contrôle d'accès. Ne jamais la redéployer avec `--no-verify-jwt`. Tout changement de code d'une Edge Function ne prend effet qu'après redéploiement.

Les e-mails s'appuient sur un gabarit HTML non éditable (en-tête, pied, structure) côté code ; seul le contenu (objet et corps) est modifiable en back-office via la table `email_templates`. Les valeurs injectées sont échappées (anti-injection HTML).

---

## 5. Base de données : migrations

Les migrations sont appliquées manuellement par Thomas dans le SQL Editor Supabase (le MCP Supabase est connecté à un autre projet, voir section 9).

| Migration | Objet | Application |
|---|---|---|
| `20260505000000_initial_schema.sql` | Schéma initial (tables, vues, enums, triggers, RLS) | appliquée |
| `20260512000000_resident_proof.sql` | Tarif habitant, justificatif, bucket privé | appliquée |
| `20260519000000_harden_rls.sql` | Triggers anti-escalade de privilège et anti-fraude tarifaire | appliquée |
| `20260519100000_email_templates.sql` | Table `email_templates` (modèles éditables) | appliquée |
| `20260519200000_discount_codes.sql` | Codes de réduction (validation serveur) | à reconfirmer |
| `20260520000000_season_ops.sql` | Liste d'attente, rappels auto, fermeture météo | à reconfirmer |
| `20260520100000_remove_inclusive_writing.sql` | Reformulation masculin générique en base | appliquée |
| `20260527000000_keepalive.sql` | Table `keepalive_heartbeat` + RPC `keepalive()` | appliquée |
| `20260528000000_audit_fixes.sql` | Verrou `search_path`, RPC `cancel_reservation()`, rate-limit keepalive | appliquée |
| `20260528100000_staff_find_reservations.sql` | RPC `staff_find_reservations()` (recherche par nom) | appliquée |
| `20260528200000_content_update.sql` | Contenu (adresse, lieu, tarifs, politique annulation, modèles e-mail) | appliquée |

> Statut « à reconfirmer » : vérifier dans le SQL Editor que `discount_codes` et `season_ops` ont bien été exécutées. Si elles ne le sont pas, la page `/admin/reductions` et les fonctionnalités liste d'attente / rappels / fermeture météo restent inertes.

### RPC clés (toutes `SECURITY DEFINER`, `search_path` verrouillé)

- `cancel_reservation(uuid, text)` : annulation côté usager et back-office, contrôle du délai 24 h en `Europe/Paris`, libère la place.
- `staff_find_reservations(text)` : recherche par nom à l'accueil, filtrée sur le jour courant et les statuts occupants, minimum 2 caractères, 20 résultats max.
- `keepalive()` : écriture UPSERT pour réinitialiser le timer d'inactivité Supabase.
- `join_waitlist` / `leave_waitlist`, `compute_discount` : logique métier déportée côté serveur.

---

## 6. Déploiement et versioning

- **Déploiement** : automatique. Tout push (ou merge de PR) sur `main` déclenche un build Netlify et publie le site.
- **Méthode** : passer par des Pull Requests avec squash merge plutôt que des push directs sur `main`.
- **Versioning** (SemVer) : à chaque mise en production, incrémenter de façon synchronisée :
  - `src/version.ts` (constante `APP_VERSION`, affichée dans le Footer),
  - `package.json` (et `package-lock.json`),
  - `CHANGELOG.md` (entrée datée).
- **Anti-pause Supabase** : workflow `.github/workflows/supabase-keepalive.yml`, deux déclenchements quotidiens (07:13 et 19:13 UTC) appelant `POST /rest/v1/rpc/keepalive`. Le timer d'inactivité du tier Supabase se base sur l'activité base de données réelle (écritures), pas sur les hits du gateway REST : un simple `select` ne suffit pas.

---

## 7. Sécurité

- Identité et rôle de l'agent dérivés du JWT dans `scan-qr` (fail-closed en 401/403). Ne jamais réintroduire un opt-out basé sur le corps de la requête.
- `set search_path = public, pg_temp` sur toutes les fonctions `SECURITY DEFINER` (parade au shadowing de schéma).
- Content-Security-Policy stricte dans `netlify.toml` (`default-src 'self'` + allowlist Supabase / Stripe, `frame-ancestors 'none'`, HSTS preload, X-Frame-Options DENY).
- `process-notifications` exige un `Authorization: Bearer <CRON_SECRET>` (ou la service role key) : endpoint non appelable par anon.
- `create-checkout-session` : contrôle de propriété de la réservation, vérification JWT, CORS restreint au domaine de production.
- Export CSV admin échappé contre l'injection de formules (`= + - @`).
- Triggers anti-escalade de privilège et anti-fraude tarifaire en base (la remise et les prix sont recalculés côté serveur).

---

## 8. Conformité

- **RGPD** : données hébergées en UE (Frankfurt), bandeau cookies accessible, droit à l'oubli (suppression de compte), minimisation des PII dans la recherche agent.
- **RGAA 4.1 / WCAG 2.1 AA** (loi du 11 octobre 2019) : déclaration d'accessibilité conforme au modèle DINUM, mention obligatoire en pied de page, composants accessibles (modal, bandeau cookies, formulaire de réservation), troisième voie d'accès au scanner (recherche par nom) pour les agents non voyants.

---

## 9. Pièges connus

- **MCP Supabase** : connecté à un autre projet que `nunglkeqekxzpmushxty`. Les migrations et déploiements de fonctions se font manuellement (SQL Editor, CLI). Merger une PR n'exécute jamais le SQL.
- **`scan-qr`** : à déployer SANS `--no-verify-jwt` ; les cinq autres fonctions AVEC.
- **Vues PostgreSQL** : `create or replace view` n'accepte que l'ajout de colonnes en fin de liste (sinon erreur 42P16).
- **Identifiants techniques** : le dépôt, les comptes et l'ancien sous-domaine gardent volontairement la graphie `baignade-rivesdaparis` (trait d'union). Le domaine public reste `lesrivesdeparis.fr`. Ne pas confondre avec l'ancienne erreur `rivesdaparis.fr` (corrigée en v1.1.1).

### Conventions de rédaction (consignes client)

- Communication en français, registre soutenu et professionnel.
- Écriture inclusive interdite (pas de point médian ni de doublets) : masculin générique.
- Tirets cadratin et demi-cadratin interdits (« — » et « – »). Utiliser deux-points, parenthèses, virgules ou puces. Le trait d'union « - » reste réservé aux mots composés (Neuilly-sur-Marne).

---

## 10. Points en attente avant ouverture publique

1. **Horaires détaillés** (semaine, week-end, jours fériés) à confirmer par la mairie, condition préalable à la génération des créneaux de toute la saison (prévue en v1.4.3).
2. **Gratuité des créneaux du 4 juillet** (16h et 18h, jour de l'inauguration) à confirmer.
3. **Vérification du domaine `lesrivesdeparis.fr` chez Brevo** (enregistrements DNS SPF / DKIM) pour activer les e-mails transactionnels.
4. **Compte Stripe** à créer par la mairie, puis injection des clés `STRIPE_*` côté secrets Supabase.

> Tant que Brevo et Stripe ne sont pas finalisés, le tunnel de réservation et l'envoi des confirmations restent en pré-production.
