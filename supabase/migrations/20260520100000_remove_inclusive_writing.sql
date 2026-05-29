-- =====================================================================
-- Mise au masculin générique des modèles d'e-mails déjà en base
-- =====================================================================
-- Les seeds initiaux contenaient « recontacté·e », « inscrit·e ». Comme
-- les inserts d'origine utilisent ON CONFLICT DO NOTHING, rejouer la
-- migration ne corrige pas les valeurs déjà présentes, d'où ce UPDATE
-- explicite. Idempotent (les remplacements de chaînes ne s'appliquent
-- que si la forme inclusive est encore présente).
-- =====================================================================

update public.email_templates
   set body_html = replace(body_html, 'recontacté·e', 'recontacté'),
       updated_at = now()
 where key = 'closure'
   and body_html like '%recontacté·e%';

update public.email_templates
   set body_html = replace(body_html, 'inscrit·e', 'inscrit'),
       updated_at = now()
 where key = 'waitlist_offered'
   and body_html like '%inscrit·e%';

-- Garde-fou : aucune autre forme inclusive ne doit subsister dans les
-- modèles. Si une est détectée, on lève une alerte (la migration
-- continue, on évite simplement de masquer un problème).
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.email_templates
   where body_html ~ '[a-zéèà]·[a-z]'
      or subject   ~ '[a-zéèà]·[a-z]';
  if v_count > 0 then
    raise notice 'Attention : % modèle(s) e-mail contiennent encore une écriture inclusive (point médian). À auditer manuellement.', v_count;
  end if;
end$$;

select 'remove_inclusive_writing: OK' as result;
