-- =====================================================================
-- E-mails automatiques éditables depuis le back-office
-- =====================================================================
-- Table des modèles transactionnels. Seul le CONTENU (objet + corps)
-- est éditable ; le gabarit (en-tête, pied, QR, structure responsive)
-- reste contrôlé par l'Edge Function (non cassable).
-- Variables disponibles dans objet & corps :
--   {{prenom}} {{nom}} {{reference}} {{date}} {{horaire}}
--   {{nb_personnes}} {{total}} {{lieu}} {{lien_compte}}
-- Idempotent.
-- =====================================================================

create table if not exists public.email_templates (
  key        text primary key,
  name       text not null,
  subject    text not null,
  body_html  text not null,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.email_templates enable row level security;

drop policy if exists email_templates_admin on public.email_templates;
create policy email_templates_admin on public.email_templates for all
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_email_templates_updated on public.email_templates;
create trigger trg_email_templates_updated
  before update on public.email_templates
  for each row execute function public.touch_updated_at();

-- Modèles par défaut (insérés seulement s'ils n'existent pas, l'édition
-- back-office ne sera pas écrasée à un rejeu de la migration).
insert into public.email_templates (key, name, subject, body_html) values
(
  'confirmation',
  'Confirmation de réservation',
  'Votre réservation est confirmée : {{date}}',
  '<p>Bonjour {{prenom}},</p>'
  '<p>Votre réservation est confirmée. Présentez le QR code ci-dessous à l''accueil le jour de votre visite.</p>'
  '<p><strong>Date :</strong> {{date}}<br><strong>Horaire :</strong> {{horaire}}<br><strong>Personnes :</strong> {{nb_personnes}}<br><strong>Total payé :</strong> {{total}}</p>'
  '<p><strong>Lieu :</strong> {{lieu}}</p>'
  '<p>À apporter : maillot de bain, serviette, crème solaire. Casiers gratuits sur place.</p>'
  '<p><a href="{{lien_compte}}">Voir ma réservation</a></p>'
),
(
  'reminder_j1',
  'Rappel J-1',
  'Demain : votre baignade à Neuilly-sur-Marne',
  '<p>Bonjour {{prenom}},</p><p>Petit rappel : votre créneau de baignade est prévu <strong>demain {{date}}</strong>, de {{horaire}}. Pensez à votre QR code (réf. {{reference}}).</p><p>À demain !</p>'
),
(
  'reminder_h1',
  'Rappel H-1',
  'Votre créneau commence dans 1 heure',
  '<p>Bonjour {{prenom}},</p><p>Votre créneau de baignade ({{horaire}}) commence bientôt. Présentez votre QR code à l''accueil. Réf. {{reference}}.</p>'
),
(
  'closure',
  'Fermeture météo',
  'Information importante : créneau du {{date}} modifié',
  '<p>Bonjour {{prenom}},</p><p>En raison des conditions météo, votre créneau du <strong>{{date}}</strong> ({{horaire}}) est impacté. Vous serez recontacté pour un report ou un remboursement.</p><p>Merci de votre compréhension.</p>'
),
(
  'satisfaction',
  'Enquête de satisfaction',
  'Votre avis sur votre baignade du {{date}}',
  '<p>Bonjour {{prenom}},</p><p>Vous avez profité de la zone de baignade le {{date}}. Votre avis nous aide à améliorer le service, merci de prendre quelques instants depuis votre espace : <a href="{{lien_compte}}">donner mon avis</a>.</p>'
)
on conflict (key) do nothing;

select key, name, subject from public.email_templates order by key;
