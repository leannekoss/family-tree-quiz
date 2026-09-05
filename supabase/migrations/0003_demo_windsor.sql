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
