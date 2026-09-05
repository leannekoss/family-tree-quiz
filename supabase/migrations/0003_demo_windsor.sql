-- 0003_demo_windsor — la famille devient configurable, et l'arbre peut passer
-- en lecture seule pour une démo publique.

-- 1. Le camp d'une branche vit en base, plus dans le code de la fonction.
alter table branches add column if not exists camp text;

create or replace function public.camp_de(branche text) returns text
  language sql stable
  set search_path to 'public'
  as $$ select camp from branches where name = branche $$;

-- anecdote_du_jour() sans l'exception codée en dur sur une branche : le camp
-- vient de camp_de(), donc de branches.camp.
create or replace function public.anecdote_du_jour()
  returns table(id integer, titre text, texte text, source text, person_id uuid,
                prenom text, nom text, photo_url text, place_id integer,
                maison text, combien integer)
  language sql security definer
  set search_path to 'public'
  as $$
  with ma_fiche as (
    select m.person_id as id from members m where m.user_id = (select auth.uid())
  ), ma_branche as (
    select coalesce(
      (select b.name from people p join branches b on b.id = p.branch_id
        where p.id = (select id from ma_fiche)),
      (select b.name from unions u
         join people c on c.id = case when u.p1_id = (select id from ma_fiche) then u.p2_id else u.p1_id end
         join branches b on b.id = c.branch_id
        where (select id from ma_fiche) in (u.p1_id, u.p2_id) limit 1)
    ) as branche
  ), mien as (
    select (select camp_de(branche) from ma_branche) as camp
  ), jour as (
    select (extract(doy from (now() at time zone 'Europe/Paris'))::int) as n
  ), lot as (
    select a.* from anecdotes a
     where a.pour_camp is null or a.pour_camp = (select camp from mien)
  ), total as (
    select count(*)::int as c from lot
  )
  select l.id, l.titre, l.texte, l.source,
         l.person_id, p.first_name, p.last_name, p.photo_url,
         l.place_id, pl.name, t.c
    from lot l
    cross join total t
    left join people p on p.id = l.person_id
    left join places pl on pl.id = l.place_id
   where is_member() and t.c > 0
   order by l.ordre, l.id
   offset (select j.n % t.c from jour j, total t)
   limit 1;
$$;

-- 2. Lecture seule : quand app_config.lecture_seule = 'oui', seuls les
-- gardiens écrivent encore dans l'arbre. Les scores, les membres et les
-- remerciements ne sont pas concernés : on peut toujours jouer.
insert into app_config (key, value) values ('lecture_seule', 'non') on conflict do nothing;

create or replace function public.lecture_seule() returns boolean
  language sql stable security definer
  set search_path to 'public'
  as $$ select coalesce((select value from app_config where key = 'lecture_seule'), 'non') = 'oui' $$;

revoke all on function public.lecture_seule() from public;
grant execute on function public.lecture_seule() to anon, authenticated, service_role;

-- people
drop policy if exists "people_ins" on public.people;
create policy "people_ins" on public.people for insert
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "people_upd" on public.people;
create policy "people_upd" on public.people for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "people_del" on public.people;
create policy "people_del" on public.people for delete
  using (is_admin() and (is_admin() or not lecture_seule()));

-- unions
drop policy if exists "unions_ins" on public.unions;
create policy "unions_ins" on public.unions for insert
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "unions_upd" on public.unions;
create policy "unions_upd" on public.unions for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "unions_del" on public.unions;
create policy "unions_del" on public.unions for delete
  using (is_admin() and (is_admin() or not lecture_seule()));

-- anecdotes : aucune policy d'écriture dans 0001 (lecture seulement), rien à refaire.

-- photo_marks
drop policy if exists "les membres posent des reperes" on public.photo_marks;
create policy "les membres posent des reperes" on public.photo_marks for insert
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "les membres nomment les reperes" on public.photo_marks;
create policy "les membres nomment les reperes" on public.photo_marks for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "on efface ce qu'on a pose" on public.photo_marks;
create policy "on efface ce qu'on a pose" on public.photo_marks for delete
  using ((created_by = (select auth.uid()) or is_admin()) and (is_admin() or not lecture_seule()));

-- places
drop policy if exists "places_ins" on public.places;
create policy "places_ins" on public.places for insert
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "places_upd" on public.places;
create policy "places_upd" on public.places for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "places_delete" on public.places;
create policy "places_delete" on public.places for delete
  using (is_admin() and (is_admin() or not lecture_seule()));

-- place_stories
drop policy if exists "chacun ecrit le sien" on public.place_stories;
create policy "chacun ecrit le sien" on public.place_stories for insert
  with check (is_member() and user_id = (select auth.uid()) and (is_admin() or not lecture_seule()));
drop policy if exists "chacun modifie le sien" on public.place_stories;
create policy "chacun modifie le sien" on public.place_stories for update
  using (user_id = (select auth.uid()) and (is_admin() or not lecture_seule()))
  with check (user_id = (select auth.uid()) and (is_admin() or not lecture_seule()));
drop policy if exists "chacun efface le sien" on public.place_stories;
create policy "chacun efface le sien" on public.place_stories for delete
  using (user_id = (select auth.uid()) and (is_admin() or not lecture_seule()));

-- group_photos
drop policy if exists "group_photos_ins" on public.group_photos;
create policy "group_photos_ins" on public.group_photos for insert to authenticated
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "group_photos_del" on public.group_photos;
create policy "group_photos_del" on public.group_photos for delete to authenticated
  using (is_admin() and (is_admin() or not lecture_seule()));

-- photo_candidates (pas d'insert ni de delete dans 0001)
drop policy if exists "photo_candidates_refuse" on public.photo_candidates;
create policy "photo_candidates_refuse" on public.photo_candidates for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));

-- photo_tasks
drop policy if exists "photo_tasks_ins" on public.photo_tasks;
create policy "photo_tasks_ins" on public.photo_tasks for insert to authenticated
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "photo_tasks_pass" on public.photo_tasks;
create policy "photo_tasks_pass" on public.photo_tasks for update
  using (is_member() and (is_admin() or not lecture_seule()))
  with check (is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "photo_tasks_del" on public.photo_tasks;
create policy "photo_tasks_del" on public.photo_tasks for delete to authenticated
  using (is_admin() and (is_admin() or not lecture_seule()));

-- Bucket visages : la lecture reste, les écritures suivent la lecture seule.
drop policy if exists "visages deposables par la famille" on storage.objects;
create policy "visages deposables par la famille"
  on storage.objects for insert
  with check (bucket_id = 'visages' and is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "visages remplacables par la famille" on storage.objects;
create policy "visages remplacables par la famille"
  on storage.objects for update
  using (bucket_id = 'visages' and is_member() and (is_admin() or not lecture_seule()))
  with check (bucket_id = 'visages' and is_member() and (is_admin() or not lecture_seule()));
drop policy if exists "visages supprimables par la famille" on storage.objects;
create policy "visages supprimables par la famille"
  on storage.objects for delete
  using (bucket_id = 'visages' and is_member() and (is_admin() or not lecture_seule()));


-- 3. Deux écritures qui échappaient au mode lecture seule (audit du 05/09) :
--    la création de branche, et la restauration d'une fiche depuis le journal
--    (SECURITY DEFINER : elle passe outre les policies de `people`).
drop policy if exists branches_ins on public.branches;
create policy branches_ins on public.branches for insert
  with check (is_member() and (is_admin() or not lecture_seule()));

CREATE OR REPLACE FUNCTION "public"."restaurer_fiche"("audit_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ligne audit_log%rowtype;
  cible uuid;
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;
  -- Lecture seule : restaurer est une écriture comme une autre.
  if lecture_seule() and not is_admin() then
    raise exception 'lecture seule';
  end if;

  select * into ligne from audit_log where id = audit_id;
  if not found then
    raise exception 'modification introuvable';
  end if;
  if ligne.table_name <> 'people' then
    raise exception 'seules les fiches se restaurent';
  end if;
  if ligne.old_data is null then
    raise exception 'cette entrée est une création : il n''y a pas d''état antérieur';
  end if;

  cible := ligne.row_id;

  -- Les colonnes générées (birth_year, search_text) se recalculent seules, et
  -- l'identifiant ne se restaure évidemment pas.
  update people p set
    first_name   = ligne.old_data->>'first_name',
    last_name    = ligne.old_data->>'last_name',
    married_name = ligne.old_data->>'married_name',
    nickname     = ligne.old_data->>'nickname',
    sex          = ligne.old_data->>'sex',
    father_id    = nullif(ligne.old_data->>'father_id','')::uuid,
    mother_id    = nullif(ligne.old_data->>'mother_id','')::uuid,
    branch_id    = nullif(ligne.old_data->>'branch_id','')::int,
    place_id     = nullif(ligne.old_data->>'place_id','')::int,
    place_detail = ligne.old_data->>'place_detail',
    birth_display= ligne.old_data->>'birth_display',
    death_display= ligne.old_data->>'death_display',
    deceased     = coalesce((ligne.old_data->>'deceased')::boolean, false),
    photo_url    = ligne.old_data->>'photo_url',
    notes        = ligne.old_data->>'notes'
  where p.id = cible;

  return 'fiche restaurée';
end $$;


ALTER FUNCTION "public"."restaurer_fiche"("audit_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_people"("q" "text") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "married_name" "text", "birth_display" "text", "deceased" boolean, "branch_name" "text", "photo_url" "text", "sex" "text", "score" real)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  besoin text := f_unaccent(lower(q));
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);

  return query
  with candidats as (
    select p.id as pid,
           greatest(
             word_similarity(besoin, p.search_text),
             word_similarity(besoin,
               f_unaccent(lower(split_part(p.first_name, ' ', 1) || ' ' || p.last_name))),
             coalesce(word_similarity(besoin,
               f_unaccent(lower(split_part(p.first_name, ' ', 1) || ' ' || p.married_name))), 0::real),
             coalesce((
               select max(word_similarity(besoin,
                            f_unaccent(lower(p.first_name || ' ' || c.last_name))))
                 from unions u
                 join people c
                   on c.id = case when u.p1_id = p.id then u.p2_id else u.p1_id end
                where p.id in (u.p1_id, u.p2_id)
                  and c.last_name is not null
             ), 0::real)
           )::real as s
      from people p
      -- 🔑 Les aïeux lointains sortent de la recherche ordinaire. Quatre cent
      -- soixante-deux marchands de Lunebourg et notaires genevois, arrivés par
      -- l'import GEDCOM, noieraient « Chastel » ou « Morel » sous des homonymes
      -- du XVIᵉ siècle. Ils restent trouvables en cochant « chez nos aïeux
      -- lointains », qui interroge le relevé FamilySearch et mène à leur fiche.
      --
      -- 🔑 Le critère est « SANS NOTES », pas seulement « ancien ». Une fiche
      -- annotée est une fiche que quelqu'un a travaillée : le général
      -- de 1736 et l'aïeul maire de sa ville en 1748 sont nés avant 1800
      -- et doivent rester sous la main. Écrire
      -- une note sur un aïeu suffit à le faire réapparaître — aucun réglage à
      -- retenir, et c'est le geste qu'on fait de toute façon quand on découvre
      -- quelque chose sur quelqu'un.
      --
      -- 🔑 Le repli à 1799 traite « aucune date connue » comme lointain. Ce
      -- n'est pas une approximation commode : une personne sans naissance, sans
      -- décès et sans note n'a rien à offrir à une recherche, et l'écrasante
      -- majorité de ces fiches sont des conjoints du XVIIᵉ siècle relevés pour
      -- ne pas couper une filiation.
     where not (p.collateral
                and p.notes is null
                and coalesce(p.birth_year, p.death_year - 70, 1799) < 1800)
  ),
  retenus as (
    select pid, s from candidats where s >= 0.4::real
  ),
  borne as (
    select max(s) as m from retenus
  )
  select p.id, p.first_name, p.last_name, p.married_name,
         p.birth_display, p.deceased, b.name, p.photo_url, p.sex, r.s
    from retenus r
    join people p on p.id = r.pid
    left join branches b on b.id = p.branch_id
    cross join borne
   where r.s >= (0.6 * borne.m)::real
   -- 🔑 À pertinence égale, les RÉCENTS d'abord. Le tri croissant d'origine
   -- remontait les plus vieux : sans conséquence à cent soixante-six anciens,
   -- il aurait fait sortir Jean Chastel de 1550 avant Nicolas Chastel de 1988.
   order by r.s desc, p.birth_year desc nulls last
   limit 25;
end
$$;
