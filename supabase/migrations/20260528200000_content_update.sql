-- =====================================================================
-- Mise à jour de contenu — politique 2026, lieu, casiers, inauguration
-- =====================================================================
-- Aligne le contenu en base sur le cahier des charges du 2026-05-28
-- (CONCILIUM / Mairie de Neuilly-sur-Marne) :
--   - Adresse mairie : 1 place François Mitterrand (et non Ferdinand
--     Buisson)
--   - Lieu de baignade : Chemin de la Haute-Île, à 20 min à pied du RER A
--   - Annulation : aucun remboursement, report uniquement en cas de
--     fermeture météo
--   - Modèles e-mail : retrait de la mention « casiers gratuits »,
--     ajout du message de vigilance (aucun casier, objets de valeur),
--     ajustement du modèle closure (report uniquement)
--   - Tarifs : nocéen 2 €, extérieur 5 €, groupe 3 € (≥ 10 personnes)
--
-- Idempotent. Les valeurs en base sont mises à jour par UPDATE explicite
-- (le `on conflict do nothing` des seeds initiaux ne réécrit pas, donc
-- un re-insert n'aurait aucun effet).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. site_settings : politique de remboursement et coordonnées
-- ---------------------------------------------------------------------
update public.site_settings
   set value = '"Aucun remboursement en cas d''annulation. En cas de fermeture pour raisons météo ou sanitaires, un report sur un autre créneau est proposé."'::jsonb
 where key = 'refund_policy';

update public.site_settings
   set value = '"baignade@neuillysurmarne.fr"'::jsonb
 where key = 'contact_email';

-- Localisation (nouvelle clé idempotente)
insert into public.site_settings (key, value)
values ('location_address', '"Chemin de la Haute-Île, 93330 Neuilly-sur-Marne"'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.site_settings (key, value)
values ('location_transport', '"À environ 20 minutes à pied du RER A."'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.site_settings (key, value)
values ('mairie_address', '"1 place François Mitterrand, 93330 Neuilly-sur-Marne"'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Le délai d'annulation reste à 24 h (libération de la place pour la
-- liste d'attente). C'est uniquement la POLITIQUE de remboursement qui
-- change : pas de remboursement quelle que soit la date d'annulation.

-- ---------------------------------------------------------------------
-- 2. email_templates : confirmation + closure
-- ---------------------------------------------------------------------
-- `confirmation` : retire la mention « Casiers gratuits sur place », ajoute
-- la consigne de vigilance pour les affaires personnelles, et précise le
-- nouveau lieu.
update public.email_templates
   set body_html =
     '<p>Bonjour {{prenom}},</p>'
     '<p>Votre réservation est confirmée. Présentez le QR code ci-dessous à l''accueil le jour de votre visite.</p>'
     '<p><strong>Date :</strong> {{date}}<br><strong>Horaire :</strong> {{horaire}}<br><strong>Personnes :</strong> {{nb_personnes}}<br><strong>Total payé :</strong> {{total}}</p>'
     '<p><strong>Lieu :</strong> {{lieu}}</p>'
     '<p><strong>À apporter :</strong> maillot de bain, serviette, crème solaire, bouteille d''eau.</p>'
     '<p><strong>Vigilance :</strong> aucun casier n''est mis à disposition. Chaque usager est responsable de ses affaires. Il est fortement déconseillé d''apporter des objets de valeur.</p>'
     '<p><a href="{{lien_compte}}">Voir ma réservation</a></p>'
 where key = 'confirmation';

-- `closure` : la fermeture météo donne lieu à un REPORT uniquement
-- (politique sans remboursement). Reformulation conforme.
update public.email_templates
   set subject = 'Information importante — créneau du {{date}} reporté',
       body_html =
         '<p>Bonjour {{prenom}},</p>'
         '<p>En raison des conditions météo, votre créneau du <strong>{{date}}</strong> ({{horaire}}) ne pourra pas se tenir.</p>'
         '<p>Conformément aux conditions générales d''utilisation, aucun remboursement n''est effectué : un <strong>report</strong> sur un autre créneau de la saison vous sera proposé par courriel dans les prochains jours.</p>'
         '<p>Merci de votre compréhension.</p>'
 where key = 'closure';

-- ---------------------------------------------------------------------
-- Contrôle rapide
-- ---------------------------------------------------------------------
select 'content_update OK' as result,
       (select value from public.site_settings where key = 'refund_policy') as refund_policy,
       (select value from public.site_settings where key = 'location_address') as location;
