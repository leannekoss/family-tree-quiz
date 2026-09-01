


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."anecdote_du_jour"() RETURNS TABLE("id" integer, "titre" "text", "texte" "text", "source" "text", "person_id" "uuid", "prenom" "text", "nom" "text", "photo_url" "text", "place_id" integer, "maison" "text", "combien" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    -- Les Lanvin reçoivent les histoires Moulin bien qu'ils soient de la Bastide :
    -- c'est par Amélie Vernet que la branche s'y rattache, et ces récits
    -- sont les siens.
    select case when (select branche from ma_branche) = 'Lanvin' then 'Moulin'
                else (select camp_de(branche) from ma_branche) end as camp
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


ALTER FUNCTION "public"."anecdote_du_jour"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anniversaires"("fenetre" integer DEFAULT 7) RETURNS TABLE("id" "uuid", "nom" "text", "prenom" "text", "photo_url" "text", "jour" integer, "mois" integer, "age" integer, "dans_x_jours" integer, "rond" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ajd date := (now() at time zone 'Europe/Paris')::date;
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;

  return query
  with fetes as (
    select p.id, p.first_name, p.married_name, p.last_name, p.photo_url,
           p.birth_day as j, p.birth_month as m, p.birth_year as annee,
           make_date(
             extract(year from ajd)::int,
             p.birth_month,
             least(
               p.birth_day,
               extract(day from (
                 make_date(extract(year from ajd)::int, p.birth_month, 1)
                 + interval '1 month - 1 day'))::int
             )
           ) as cette_annee
      from people p
     where p.birth_month is not null
       and p.birth_day is not null
       and not p.deceased
       -- 🔑 CEINTURE. Le drapeau `deceased` était calculé à l'import sur la
       -- seule présence d'une date de décès : un aïeul du XVIIᵉ siècle dont le
       -- GEDCOM ignore la mort passait pour vivant, et une aïeule du XVIIᵉ siècle
       -- a fêté ses 339 ans sur la page d'accueil, devant la famille.
       -- Les données sont corrigées, mais la fonction ne doit plus pouvoir
       -- l'afficher même si un futur import remet un drapeau de travers :
       -- on souhaite un anniversaire à quelqu'un qu'on peut appeler.
       and p.birth_year is not null
       and p.birth_year > extract(year from ajd)::int - 110
       -- 🔑 Et jamais un collatéral : ils sont hors du dispositif photos et du
       -- quiz pour la même raison — personne dans la famille ne les connaît.
       and not p.collateral
  ),
  situees as (
    select f.*,
           case when f.cette_annee >= ajd
                then f.cette_annee
                else f.cette_annee + interval '1 year' end::date as prochain
      from fetes f
  )
  select s.id,
         s.first_name || ' ' || coalesce(s.married_name, s.last_name),
         s.first_name,
         s.photo_url,
         s.j,
         s.m,
         (extract(year from s.prochain)::int - s.annee) as age,
         (s.prochain - ajd)::int as dans_x_jours,
         ((extract(year from s.prochain)::int - s.annee) % 10 = 0) as rond
    from situees s
   where (s.prochain - ajd)::int <= greatest(fenetre, 0)
     and s.annee is not null
   order by (s.prochain - ajd)::int, age desc;
end $$;


ALTER FUNCTION "public"."anniversaires"("fenetre" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."arrivees"("jours" integer DEFAULT 7) RETURNS TABLE("total" bigint, "sur_la_periode" bigint, "jour" "date", "ce_jour_la" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    if not is_admin() then
      raise exception 'réservé au gardien';
    end if;

    return query
    with borne as (
      -- Une date, et non « maintenant moins n × 24 heures » : on compte des
      -- journées. Quelqu'un entré ce matin doit tomber dans « les sept derniers
      -- jours » quelle que soit l'heure à laquelle on pose la question.
      select (current_date - greatest(jours, 1) + 1) as depuis
    )
    select
      (select count(*) from members),
      (select count(*) from members mm, borne b2 where mm.joined_at >= b2.depuis),
      m.joined_at::date,
      count(*)
    from members m, borne b
    where m.joined_at >= b.depuis
    group by m.joined_at::date
    order by 3 desc;
  end;
$$;


ALTER FUNCTION "public"."arrivees"("jours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_allowed_emails"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into audit_log(table_name, row_id, action, old_data, new_data)
  values (
    'allowed_emails',
    md5(coalesce(new.email, old.email))::uuid,  -- identifiant stable dérivé de l'adresse
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."audit_allowed_emails"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_places"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into audit_log(table_name, row_id, action, changed_by, old_data, new_data)
  values (
    'places',
    md5(coalesce(new.id, old.id)::text)::uuid,
    lower(tg_op),
    auth.uid(),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;


ALTER FUNCTION "public"."audit_places"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    insert into audit_log(table_name, row_id, action, old_data, new_data)
    values (tg_table_name, old.id, tg_op, to_jsonb(old), null);
    return old;
  end if;
  insert into audit_log(table_name, row_id, action, old_data, new_data)
  values (tg_table_name, new.id, tg_op,
          case when tg_op = 'UPDATE' then to_jsonb(old) end,
          to_jsonb(new));
  return new;
end $$;


ALTER FUNCTION "public"."audit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."camp_de"("branche" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when branche in ('Bardin','Rouvière','Aubry','Vernet','Delcourt','Perrin')
      then 'Moulin'
    when branche in ('Chastel','Morel','Lanvin')
      then 'Bastide'
  end;
$$;


ALTER FUNCTION "public"."camp_de"("branche" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chercher_ailleurs"("q" "text") RETURNS TABLE("pid" "text", "nom_complet" "text", "ne" integer, "mort" integer, "sexe" "text", "deja_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select f.pid, f.nom_complet, f.ne, f.mort, f.sexe, f.person_id
    from familysearch_import f
   where is_member()
     and length(btrim(q)) >= 2
     and unaccent(lower(f.nom_complet)) like '%' || unaccent(lower(btrim(q))) || '%'
   order by f.person_id nulls first, f.ne nulls last
   limit 25
$$;


ALTER FUNCTION "public"."chercher_ailleurs"("q" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classement"("combien" integer DEFAULT 10) RETURNS TABLE("pseudo" "text", "score" integer, "justes" integer, "total" integer, "played_at" timestamp with time zone, "a_moi" boolean, "person_id" "uuid", "emoji" "text", "photo_url" "text", "serie" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select * from (
    select distinct on (s.user_id)
           s.pseudo, s.score, s.justes, s.total, s.played_at,
           s.user_id = auth.uid() as a_moi,
           m.person_id,
           p.emoji,
           p.photo_url,
           coalesce(sj.jours, 0) as serie
      from scores s
      left join members m on m.user_id = s.user_id
      left join people p on p.id = m.person_id
      left join series_par_joueur() sj on sj.user_id = s.user_id
     where is_member()
     order by s.user_id, s.score desc, s.played_at
  ) meilleurs
  order by meilleurs.score desc, meilleurs.played_at
  limit greatest(1, least(combien, 50))
$$;


ALTER FUNCTION "public"."classement"("combien" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classement_branches"() RETURNS TABLE("branche" "text", "meilleur" integer, "joueurs" bigint, "champion" "text", "champion_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with par_personne as (
    select distinct on (s.user_id) s.user_id, s.pseudo, s.branche, s.score, m.person_id
      from scores s
      left join members m on m.user_id = s.user_id
     where is_member() and s.branche is not null
     order by s.user_id, s.score desc, s.played_at
  )
  select p.branche,
         max(p.score)::integer,
         count(*),
         (array_agg(p.pseudo order by p.score desc))[1],
         -- Le champion et son identifiant sont pris dans le MÊME ordre : deux
         -- agrégats triés séparément finiraient par désigner deux personnes
         -- différentes le jour où deux scores s'égalent.
         (array_agg(p.person_id order by p.score desc))[1]
    from par_personne p
   group by p.branche
   order by max(p.score) desc
$$;


ALTER FUNCTION "public"."classement_branches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classement_camps"() RETURNS TABLE("camp" "text", "meilleur" integer, "joueurs" bigint, "branches" bigint, "champion" "text", "champion_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with par_personne as (
    -- Le meilleur score de chaque joueur, comme au classement par branche :
    -- une famille où l'un joue vingt fois n'écrase pas celle où l'on joue une.
    select distinct on (s.user_id)
           s.user_id, s.pseudo, s.branche, s.score, m.person_id
      from scores s
      left join members m on m.user_id = s.user_id
     where is_member() and s.branche is not null
     order by s.user_id, s.score desc, s.played_at
  )
  select camp_de(p.branche),
         max(p.score)::integer,
         count(*),
         count(distinct p.branche),
         (array_agg(p.pseudo order by p.score desc))[1],
         -- Champion et identifiant tirés dans le MÊME ordre : deux agrégats
         -- triés séparément désigneraient deux personnes le jour où deux
         -- scores s'égalent.
         (array_agg(p.person_id order by p.score desc))[1]
    from par_personne p
   where camp_de(p.branche) is not null
   group by camp_de(p.branche)
   order by max(p.score) desc
$$;


ALTER FUNCTION "public"."classement_camps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classement_du_jour"("combien" integer DEFAULT 5) RETURNS TABLE("pseudo" "text", "score" integer, "justes" integer, "total" integer, "a_moi" boolean, "person_id" "uuid", "emoji" "text", "photo_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select * from (
    select distinct on (s.user_id)
           s.pseudo, s.score, s.justes, s.total,
           s.user_id = auth.uid() as a_moi,
           m.person_id,
           p.emoji,
           p.photo_url
      from scores s
      left join members m on m.user_id = s.user_id
      left join people p on p.id = m.person_id
     where is_member()
       and (s.played_at at time zone 'Europe/Paris')::date
           = (now() at time zone 'Europe/Paris')::date
     order by s.user_id, s.score desc, s.played_at
  ) meilleurs
  order by meilleurs.score desc
  limit greatest(1, least(combien, 20))
$$;


ALTER FUNCTION "public"."classement_du_jour"("combien" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classement_duel"("code_duel" "text") RETURNS TABLE("pseudo" "text", "score" integer, "justes" integer, "total" integer, "played_at" timestamp with time zone, "a_moi" boolean, "person_id" "uuid", "emoji" "text", "photo_url" "text", "serie" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select * from (select distinct on (s.user_id) s.pseudo, s.score, s.justes, s.total, s.played_at, s.user_id = auth.uid() as a_moi, m.person_id, p.emoji, p.photo_url, coalesce(sj.jours, 0) as serie from scores s join duel_members dm on dm.user_id = s.user_id join duels d on d.id = dm.duel_id and d.code = code_duel left join members m on m.user_id = s.user_id left join people p on p.id = m.person_id left join series_par_joueur() sj on sj.user_id = s.user_id where is_member() order by s.user_id, s.score desc, s.played_at) meilleurs order by meilleurs.score desc, meilleurs.played_at $$;


ALTER FUNCTION "public"."classement_duel"("code_duel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contributeurs"() RETURNS TABLE("pseudo" "text", "photos" integer, "corrections" integer, "fiches" integer, "points" integer, "a_moi" boolean, "person_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with brut as (
    select
      coalesce(p.first_name, m.nom_declare, split_part(u.email, '@', 1)) as pseudo,
      count(*) filter (
        where a.table_name = 'people'
          and a.old_data->>'photo_url' is null
          and a.new_data->>'photo_url' is not null)::int as photos,
      count(*) filter (
        where lower(a.action) = 'update' and a.table_name = 'people')::int as corrections,
      count(*) filter (
        where a.action = 'INSERT' and a.table_name = 'people')::int as fiches,
      bool_or(a.changed_by = auth.uid()) as a_moi,
      -- `array_agg(...)[1]` et NON `min(...)` : PostgreSQL n'a pas d'agrégat min
      -- pour les uuid, et PostgREST rend cette erreur en HTTP 404 — qui fait
      -- croire à une fonction absente alors que c'est son corps qui casse.
      (array_agg(m.person_id) filter (where m.person_id is not null))[1] as person_id
    from audit_log a
    join members m on m.user_id = a.changed_by
    join auth.users u on u.id = a.changed_by
    left join people p on p.id = m.person_id
    where is_member() and a.changed_by is not null
    group by 1
  )
  select pseudo, photos, corrections, fiches,
         (photos * 10 + fiches * 5 + corrections * 2)::int as points,
         a_moi, person_id
  from brut
  where photos > 0 or corrections > 2 or fiches > 0
  order by points desc
  limit 12;
$$;


ALTER FUNCTION "public"."contributeurs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."defi_semaine"() RETURNS TABLE("camp" "text", "photos" bigint, "jours_restants" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with debut as (
    select date_trunc('week', now() at time zone 'Europe/Paris')
           at time zone 'Europe/Paris' as quand
  ),
  posees as (
    select distinct camp_de(b.name) as camp, a.row_id
      from audit_log a
      join members m on m.user_id = a.changed_by
      join people p on p.id = m.person_id
      join branches b on b.id = p.branch_id
     where a.table_name = 'people'
       and a.changed_at >= (select quand from debut)
       and a.new_data ->> 'photo_url' is not null
       and (a.old_data ->> 'photo_url') is distinct from (a.new_data ->> 'photo_url')
       and camp_de(b.name) is not null
  )
  select c.nom, count(p.row_id),
         -- lundi = 1 → il reste 7 jours (celui-ci compris) ; dimanche = 7 → 1.
         (8 - extract(isodow from now() at time zone 'Europe/Paris'))::integer
    from (values ('Moulin'), ('Bastide')) c(nom)
    left join posees p on p.camp = c.nom
   where is_member()
   group by c.nom
   order by 2 desc, 1
$$;


ALTER FUNCTION "public"."defi_semaine"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duel_par_code"("code_duel" "text") RETURNS TABLE("id" "uuid", "code" "text", "created_at" timestamp with time zone, "pseudo_createur" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select d.id, d.code, d.created_at, coalesce((select s.pseudo from scores s where s.user_id = d.created_by order by s.played_at desc limit 1), 'Quelqu''un') as pseudo_createur from duels d where d.code = code_duel limit 1 $$;


ALTER FUNCTION "public"."duel_par_code"("code_duel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."elide"("prenom" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select case when left(f_unaccent(lower($1)), 1) in ('a','e','i','o','u','y','h')
              then 'd''' else 'de ' end;
$_$;


ALTER FUNCTION "public"."elide"("prenom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exporter_migrations"() RETURNS TABLE("version" "text", "nom" "text", "sql" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'supabase_migrations'
    AS $$
begin
  if not is_admin() then
    raise exception 'reserve aux gardiens';
  end if;
  return query
    select m.version, m.name, array_to_string(m.statements, E';\n\n') || ';'
    from supabase_migrations.schema_migrations m
    order by m.version;
end $$;


ALTER FUNCTION "public"."exporter_migrations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."f_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public', 'extensions'
    AS $_$ select unaccent('unaccent', $1) $_$;


ALTER FUNCTION "public"."f_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."indice_code"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  declare
    code text;
  begin
    if not is_member() then
      raise exception 'réservé aux membres';
    end if;

    select value into code from app_config where key = 'invite_code';
    if code is null or length(code) <= 4 then
      -- Un code trop court n'a pas d'indice possible sans le donner en entier :
      -- on préfère ne rien dire plutôt que de le livrer.
      return null;
    end if;

    return left(code, 4) || repeat('*', length(code) - 4);
  end $$;


ALTER FUNCTION "public"."indice_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_code"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_admin() then
    raise exception 'reserve aux gardiens';
  end if;
  return (select value from app_config where key = 'invite_code');
end $$;


ALTER FUNCTION "public"."invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inviter_membre"("nouvel_email" "text", "qui" "text" DEFAULT NULL::"text", "secret" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $_$
declare
  addr text := lower(trim(nouvel_email));
  uid  uuid;
  mdp  text;
begin
  if not is_admin() then
    raise exception 'reserve aux gardiens';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'adresse invalide';
  end if;

  -- À défaut de secret fourni, le code famille : commode pour ouvrir en masse,
  -- mais alors le compte vaut ce que vaut le code.
  mdp := coalesce(nullif(trim(secret), ''),
                  (select value from app_config where key = 'invite_code'));

  insert into allowed_emails(email, note) values (addr, qui)
  on conflict (email) do update set note = coalesce(excluded.note, allowed_emails.note);

  select id into uid from auth.users where lower(email) = addr;

  if uid is not null then
    update auth.users
    set encrypted_password = crypt(mdp, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        -- Répare au passage un compte créé avant ce correctif.
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        updated_at = now()
    where id = uid;
    return 'compte existant mis à jour';
  end if;

  uid := gen_random_uuid();

  insert into auth.users(
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    -- Chaînes vides et non NULL : c'est toute la correction.
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    addr, crypt(mdp, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', uid::text, 'email', addr,
                       'email_verified', true, 'phone_verified', false),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities(
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', addr,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return 'compte créé';
end $_$;


ALTER FUNCTION "public"."inviter_membre"("nouvel_email" "text", "qui" "text", "secret" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from members where user_id = auth.uid() and is_admin) $$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select exists (
      select 1 from members m
      where m.user_id = auth.uid()
        and exists (
          select 1 from allowed_emails a
          where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  $$;


ALTER FUNCTION "public"."is_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_family"("code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  claimed text := lower(coalesce(auth.jwt() ->> 'email', ''));
  attendu text := (select value from app_config where key = 'invite_code');
begin
  if auth.uid() is null then
    raise exception 'non connecte';
  end if;

  -- Déjà de la famille : le mot de passe a suffi à prouver qui l'on est.
  if exists (select 1 from members where user_id = auth.uid()) then
    return;
  end if;

  -- On vérifie l'email d'abord : un code correct ne rattrape pas une adresse
  -- absente de la liste.
  if not exists (select 1 from allowed_emails where lower(email) = claimed) then
    raise exception 'adresse non autorisee';
  end if;
  if attendu is null or lower(trim(code)) is distinct from lower(attendu) then
    raise exception 'code invalide';
  end if;
  insert into members(user_id) values (auth.uid()) on conflict do nothing;
end $$;


ALTER FUNCTION "public"."join_family"("code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."joueurs_actifs"() RETURNS TABLE("user_id" "uuid", "pseudo" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select distinct on (s.user_id) s.user_id, s.pseudo from scores s where is_member() and s.user_id <> auth.uid() order by s.user_id, s.played_at desc $$;


ALTER FUNCTION "public"."joueurs_actifs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."journal_famille"("depuis_jours" integer DEFAULT 30) RETURNS TABLE("id" bigint, "quand" timestamp with time zone, "qui" "text", "quoi" "text", "sujet" "text", "sujet_id" "uuid", "detail" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;

  return query
  with brut as (
    select distinct on (a.row_id, a.changed_at, a.action)
           a.id, a.changed_at, a.changed_by, a.table_name, a.action,
           a.row_id, a.old_data, a.new_data
      from audit_log a
     where a.changed_at > now() - make_interval(days => greatest(depuis_jours, 1))
       and a.table_name in ('people', 'places', 'unions')
       -- 🔑 Une écriture SANS AUTEUR n'est l'œuvre de personne dans la famille :
       -- c'est un chargement, un import, une réparation faite en base. L'afficher
       -- sous le nom de « quelqu'un » invente un contributeur fantôme et inquiète
       -- — cent quatorze lignes « quelqu'un a touché au couple de — » à la même
       -- minute se lisent comme une intrusion, alors que c'est de la maintenance.
       -- Le journal raconte ce que LA FAMILLE fait ; le reste appartient à
       -- `audit_log`, qui garde tout et n'efface rien.
       and a.changed_by is not null
     order by a.row_id, a.changed_at, a.action, a.id
  )
  select
    b.id,
    b.changed_at,
    coalesce(
      (select p.first_name || ' ' || coalesce(p.married_name, p.last_name)
         from members m join people p on p.id = m.person_id
        where m.user_id = b.changed_by),
      (select m.nom_declare from members m where m.user_id = b.changed_by),
      (select split_part(u.email, '@', 1) from auth.users u where u.id = b.changed_by),
      'quelqu''un'
    ),
    case
      when b.table_name = 'places' and b.action = 'insert' then 'a ajouté la maison'
      when b.table_name = 'places' and b.action = 'update' then 'a déplacé'
      when b.table_name = 'places' and b.action = 'delete' then 'a retiré'
      when b.table_name = 'people' and b.action = 'insert' then 'a ajouté la fiche de'
      when b.table_name = 'people'
       and b.new_data->>'photo_url' is distinct from b.old_data->>'photo_url'
       and b.new_data->>'photo_url' is not null                then 'a ajouté la photo de'
      when b.table_name = 'people' and b.action = 'update' then 'a corrigé la fiche de'
      when b.table_name = 'people' and b.action = 'delete' then 'a retiré la fiche de'
      else 'a relié'
    end,
    coalesce(
      (select pe.first_name || ' ' || coalesce(pe.married_name, pe.last_name)
         from people pe where pe.id = b.row_id),
      coalesce(b.new_data->>'name', b.old_data->>'name'),
      -- 🔑 Pour une union, `row_id` désigne le COUPLE, pas une personne : la
      -- recherche dans `people` ne trouvait rien et rendait un tiret cadratin
      -- seul. On nomme les deux conjoints, ce que la ligne contient déjà.
      (select a1.first_name || ' ' || coalesce(a1.married_name, a1.last_name)
              || ' et ' || a2.first_name || ' ' || coalesce(a2.married_name, a2.last_name)
         from people a1, people a2
        where a1.id = coalesce(b.new_data->>'p1_id', b.old_data->>'p1_id')::uuid
          and a2.id = coalesce(b.new_data->>'p2_id', b.old_data->>'p2_id')::uuid),
      '—'
    ),
    case when b.table_name = 'people' then b.row_id else null end,
    nullif((
      select string_agg(k, ', ' order by k)
        from jsonb_each_text(coalesce(b.new_data, '{}'::jsonb)) n(k, v)
       where b.old_data is not null
         and v is distinct from (b.old_data ->> n.k)
         and k not in ('search_text', 'created_at', 'updated_at')
         and not (k = 'photo_url' and b.new_data->>'photo_url' is not null)
    ), '')
  from brut b
  order by b.changed_at desc
  limit 200;
end $$;


ALTER FUNCTION "public"."journal_famille"("depuis_jours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ma_serie"() RETURNS TABLE("jours" integer, "joue_aujourdhui" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sj.jours, 0), coalesce(sj.joue_aujourdhui, false)
    from (select 1) un
    left join series_par_joueur() sj on sj.user_id = auth.uid()
   where is_member()
$$;


ALTER FUNCTION "public"."ma_serie"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."me_declarer"("nom" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  propre   text := nullif(trim(regexp_replace(coalesce(nom, ''), '\s+', ' ', 'g')), '');
  besoin   text;
  candidat uuid;
  combien  int;
begin
  if auth.uid() is null then
    raise exception 'non connecte';
  end if;
  if propre is null then
    return 'sans nom';
  end if;

  update members set nom_declare = propre where user_id = auth.uid();

  if exists (select 1 from members where user_id = auth.uid() and person_id is not null) then
    return 'deja rattache';
  end if;

  besoin := f_unaccent(lower(propre));

  -- `search_text` empile prénom + nom de naissance + nom d'usage :
  -- « nathalie vernet roche ». Comparé à « Nathalie Roche », le score tombe
  -- à 0,60 parce que les deux mots n'y sont pas contigus — sous le seuil. Toute
  -- femme mariée donnant son nom d'usage échouait donc, soit la moitié de la
  -- famille. On compare aussi aux deux formes reconstruites et on garde la
  -- meilleure ; le seuil de 0,85 continue d'interdire le rattachement au jugé.
  select count(*) into combien from people p
   where greatest(
     word_similarity(besoin, p.search_text),
     word_similarity(besoin, f_unaccent(lower(p.first_name || ' ' || coalesce(p.married_name, p.last_name)))),
     word_similarity(besoin, f_unaccent(lower(p.first_name || ' ' || p.last_name)))
   ) >= 0.85;

  if combien = 1 then
    select p.id into candidat from people p
     where greatest(
       word_similarity(besoin, p.search_text),
       word_similarity(besoin, f_unaccent(lower(p.first_name || ' ' || coalesce(p.married_name, p.last_name)))),
       word_similarity(besoin, f_unaccent(lower(p.first_name || ' ' || p.last_name)))
     ) >= 0.85
     limit 1;
    update members set person_id = candidat where user_id = auth.uid();
    return 'rattache';
  end if;

  return case when combien = 0 then 'sans fiche' else 'plusieurs fiches' end;
end $$;


ALTER FUNCTION "public"."me_declarer"("nom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mes_premiers_pas"() RETURNS TABLE("person_id" "uuid", "prenom" "text", "a_photo" boolean, "a_emoji" boolean, "a_joue" boolean, "a_donne" boolean, "faits" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with moi as (
    select m.person_id, p.first_name, p.photo_url, p.emoji
      from members m left join people p on p.id = m.person_id
     where m.user_id = auth.uid()
  ),
  gestes as (
    select
      moi.person_id,
      moi.first_name,
      moi.photo_url is not null as a_photo,
      moi.emoji is not null as a_emoji,
      exists (select 1 from scores s where s.user_id = auth.uid()) as a_joue,
      -- Une photo posée sur QUELQU'UN D'AUTRE : la sienne est un réflexe, celle
      -- d'un cousin est le geste qui fait vivre l'arbre.
      exists (
        select 1 from audit_log a
         where a.changed_by = auth.uid()
           and a.table_name = 'people'
           and (a.new_data->>'photo_url') is not null
           and (a.new_data->>'photo_url') is distinct from coalesce(a.old_data->>'photo_url', '')
           and a.row_id is distinct from moi.person_id
      ) as a_donne
    from moi
  )
  select g.person_id, g.first_name, g.a_photo, g.a_emoji, g.a_joue, g.a_donne,
         (g.a_photo::int + g.a_emoji::int + g.a_joue::int + g.a_donne::int)
  from gestes g
  where is_member()
$$;


ALTER FUNCTION "public"."mes_premiers_pas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mon_niveau"() RETURNS TABLE("points" integer, "niveau" integer, "titre" "text", "prochain" integer, "restant" integer, "titre_prochain" "text", "jours" integer, "parties" integer, "photos" integer, "fiches" integer, "corrections" integer, "histoires" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with moi as (select auth.uid() as u),
  a as (
    select
      count(*) filter (
        where table_name = 'people' and action = 'UPDATE'
          and (new_data->>'photo_url') is distinct from (old_data->>'photo_url')
          and (new_data->>'photo_url') is not null
      )::int as photos,
      count(*) filter (where table_name = 'people' and action = 'INSERT')::int as fiches,
      count(*) filter (where table_name in ('people','unions') and action = 'UPDATE')::int as maj
    from audit_log, moi where changed_by = moi.u
  ),
  s as (select count(*)::int as parties from scores, moi where user_id = moi.u),
  h as (select count(*)::int as histoires from place_stories, moi where user_id = moi.u),
  -- Un « jour de présence » vaut par le fait d'être passé, que l'on ait joué
  -- ou corrigé : les deux gestes disent la même chose.
  j as (
    select count(distinct d)::int as jours from (
      select (changed_at at time zone 'Europe/Paris')::date as d from audit_log, moi where changed_by = moi.u
      union
      select (played_at at time zone 'Europe/Paris')::date from scores, moi where user_id = moi.u
    ) t
  ),
  p as (
    select
      j.jours * 10 + s.parties * 5 + a.photos * 10 + a.fiches * 10
        + greatest(a.maj - a.photos, 0) * 5 + h.histoires * 20 as pts,
      j.jours, s.parties, a.photos, a.fiches,
      greatest(a.maj - a.photos, 0) as corrections, h.histoires
    from a, s, h, j
  ),
  seuils as (
    select * from (values
      (1, 10, 'Curieux'), (2, 60, 'Habitué'), (3, 150, 'Fidèle'),
      (4, 400, 'Gardien'), (5, 1000, 'Mémoire de la famille')
    ) v(n, seuil, nom)
  ),
  niv as (
    select coalesce((select max(n) from seuils where seuil <= p.pts), 0) as n from p
  )
  select
    p.pts::int,
    niv.n::int,
    coalesce((select nom from seuils where n = niv.n), 'Nouveau venu'),
    (select seuil from seuils where n = niv.n + 1),
    greatest((select seuil from seuils where n = niv.n + 1) - p.pts, 0)::int,
    (select nom from seuils where n = niv.n + 1),
    p.jours, p.parties, p.photos, p.fiches, p.corrections, p.histoires
  from p, niv
  where is_member()
$$;


ALTER FUNCTION "public"."mon_niveau"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parente"("cible" "uuid") RETURNS TABLE("relation" "text", "d_cible" integer, "d_moi" integer, "parents_communs" integer, "ancetres" "jsonb", "conjoint" "jsonb", "lien_kind" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  moi uuid;
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;
  select m.person_id into moi from members m where m.user_id = auth.uid();
  if moi is null then
    return query select 'inconnu'::text, null::int, null::int, null::int,
                        null::jsonb, null::jsonb, null::text;
    return;
  end if;
  return query select * from parente_entre(cible, moi);
end $$;


ALTER FUNCTION "public"."parente"("cible" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parente_entre"("cible" "uuid", "moi" "uuid") RETURNS TABLE("relation" "text", "d_cible" integer, "d_moi" integer, "parents_communs" integer, "ancetres" "jsonb", "conjoint" "jsonb", "lien_kind" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with recursive
  racines as (
    select cible as id, 'cible'::text as role
    union all select moi, 'moi'
    union all
    select case when u.p1_id = cible then u.p2_id else u.p1_id end, 'conjoint'
    from unions u
    where u.p1_id = cible or u.p2_id = cible
  ),
  anc(root, role, anc_id, d) as (
    select r.id, r.role, r.id, 0 from racines r where r.id is not null
    union all
    select a.root, a.role, v.pid, a.d + 1
    from anc a
    join people p on p.id = a.anc_id
    cross join lateral (values (p.father_id), (p.mother_id)) v(pid)
    where v.pid is not null and a.d < 15
  ),
  croisement as (
    select a.role, a.anc_id, min(a.d)::int as dc, min(b.d)::int as dm
    from anc a
    join anc b on b.anc_id = a.anc_id and b.role = 'moi'
    where a.role in ('cible', 'conjoint')
    group by a.role, a.anc_id
  ),
  meilleur as (
    select * from croisement
    order by (role <> 'cible'), dc + dm, greatest(dc, dm)
    limit 1
  ),
  couple as (
    select c.anc_id
    from croisement c
    join meilleur m on m.role = c.role and c.dc = m.dc and c.dm = m.dm
  ),
  conjoint_lie as (
    select p.id, p.first_name, p.last_name, p.married_name, p.sex
    from meilleur m
    join anc a on a.role = 'conjoint' and a.anc_id = m.anc_id and a.d = m.dc
    join people p on p.id = a.root
    limit 1
  ),
  notre_union as (
    select u.kind from unions u
    where (u.p1_id = cible and u.p2_id = moi) or (u.p2_id = cible and u.p1_id = moi)
    limit 1
  )
  select
    case
      when cible = moi then 'soi'
      when exists (select 1 from notre_union) then 'conjoint'
      when m.role = 'cible' then 'sang'
      else 'alliance'
    end,
    m.dc, m.dm,
    (select count(*)::int from couple),
    (select jsonb_agg(jsonb_build_object(
              'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
              'married_name', p.married_name, 'sex', p.sex)
            order by p.sex desc nulls last)
       from couple c join people p on p.id = c.anc_id),
    (select jsonb_build_object('id', cl.id, 'first_name', cl.first_name,
              'last_name', cl.last_name, 'married_name', cl.married_name, 'sex', cl.sex)
       from conjoint_lie cl),
    (select kind from notre_union)
  from meilleur m
  union all
  select
    case when cible = moi then 'soi'
         when exists (select 1 from notre_union) then 'conjoint'
         else 'aucun' end,
    null::int, null::int, null::int, null::jsonb, null::jsonb,
    (select kind from notre_union)
  where not exists (select 1 from croisement);
$$;


ALTER FUNCTION "public"."parente_entre"("cible" "uuid", "moi" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."passer_tache"("tache" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update photo_tasks
     set passed_by = array_append(passed_by, auth.uid())
   where id = tache
     and is_member()
     and not (auth.uid() = any(passed_by));
$$;


ALTER FUNCTION "public"."passer_tache"("tache" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fam_jour"("display" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select case
    when display is null then null
    when display ~ '^\s*\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}'
      then nullif(substring(display from '^\s*(\d{1,2})\s*[./-]'), '')::int
    else null
  end
$$;


ALTER FUNCTION "public"."fam_jour"("display" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fam_mois"("display" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select case
    when display is null then null
    when display ~ '^\s*\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}'
      then nullif(substring(display from '^\s*\d{1,2}\s*[./-]\s*(\d{1,2})'), '')::int
    else null
  end
$$;


ALTER FUNCTION "public"."fam_mois"("display" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fam_year"("display" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $_$
  select case
    when display is null then null
    -- Année déjà sur quatre chiffres, où qu'elle soit dans la chaîne.
    when substring(display from '\d{4}') is not null
      then substring(display from '\d{4}')::int
    -- Sinon le dernier groupe de chiffres est l'année, sur deux chiffres.
    when substring(display from '(\d{1,2})\s*$') is not null
      then case
        when substring(display from '(\d{1,2})\s*$')::int <= 30
          then 2000 + substring(display from '(\d{1,2})\s*$')::int
        else 1900 + substring(display from '(\d{1,2})\s*$')::int
      end
    else null
  end
$_$;


ALTER FUNCTION "public"."fam_year"("display" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."photos_de_groupe"() RETURNS TABLE("id" bigint, "storage_path" "text", "caption" "text", "source" "text", "taken" "text", "reperes" integer, "nommes" integer, "anonymes" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select g.id, g.storage_path, g.caption, g.source, g.taken,
         count(m.id)::int,
         count(m.person_id)::int,
         (count(m.id) - count(m.person_id))::int
    from group_photos g
    left join photo_marks m on m.photo_id = g.id
   where is_member()
   group by g.id
   order by (count(m.id) - count(m.person_id)) desc, g.id desc
$$;


ALTER FUNCTION "public"."photos_de_groupe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refuser_candidat"("candidat" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update photo_candidates
     set refused_by = array_append(refused_by, auth.uid())
   where id = candidat
     and is_member()
     and not (auth.uid() = any(refused_by));
$$;


ALTER FUNCTION "public"."refuser_candidat"("candidat" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."regler_acces"("nouveau_code" "text" DEFAULT NULL::"text", "ouvert" boolean DEFAULT NULL::boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare bilan text := '';
begin
  if not is_admin() then
    raise exception 'reserve aux gardiens';
  end if;

  if nouveau_code is not null and length(trim(nouveau_code)) >= 8 then
    -- Rangé en minuscules : le clavier des téléphones ne sait pas faire
    -- autrement, autant que la règle soit la même partout.
    update app_config set value = lower(trim(nouveau_code)) where key = 'invite_code';
    bilan := 'code changé';
  elsif nouveau_code is not null then
    raise exception 'un code de moins de huit caracteres se devine';
  end if;

  if ouvert is not null then
    update app_config set value = case when ouvert then 'oui' else 'non' end
     where key = 'acces_ouvert';
    bilan := trim(both ' ,' from bilan || ', entrée libre ' ||
                  case when ouvert then 'ouverte' else 'fermée' end);
  end if;

  return coalesce(nullif(bilan, ''), 'rien à changer');
end $$;


ALTER FUNCTION "public"."regler_acces"("nouveau_code" "text", "ouvert" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $_$
declare
  addr    text := lower(trim(mon_email));
  saisi   text := lower(trim(code));
  attendu text;
  ouvert  text;
  uid     uuid;
begin
  select value into attendu from app_config where key = 'invite_code';
  select value into ouvert  from app_config where key = 'acces_ouvert';

  if coalesce(ouvert, 'non') <> 'oui' then
    raise exception 'entree libre fermee';
  end if;
  if attendu is null or saisi <> lower(attendu) then
    raise exception 'code invalide';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'adresse invalide';
  end if;

  select id into uid from auth.users where lower(email) = addr;
  if uid is not null then
    return 'compte existant';
  end if;

  insert into allowed_emails(email, note)
  values (addr, 'entrée libre avec le code famille')
  on conflict (email) do nothing;

  uid := gen_random_uuid();

  insert into auth.users(
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    addr, crypt(saisi, gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', uid::text, 'email', addr,
                       'email_verified', true, 'phone_verified', false),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities(
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', addr,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  return 'compte cree';
end $_$;


ALTER FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."search_people"("q" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_places"("q" "text") RETURNS TABLE("id" integer, "name" "text", "commune" "text", "occupants" "text", "habitants" integer, "score" real)
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
    select p.id, p.name, p.commune, p.occupants,
           (select count(*)::int from people h where h.place_id = p.id),
           greatest(
             word_similarity(besoin, f_unaccent(lower(p.name))),
             word_similarity(besoin, f_unaccent(lower(coalesce(p.commune, '')))) * 0.8,
             word_similarity(besoin, f_unaccent(lower(coalesce(p.occupants, '')))) * 0.7
           )::real as score
      from places p
     where besoin <% f_unaccent(lower(p.name))
        or besoin <% f_unaccent(lower(coalesce(p.commune, '')))
        or besoin <% f_unaccent(lower(coalesce(p.occupants, '')))
     order by score desc, p.name
     limit 6;
end $$;


ALTER FUNCTION "public"."search_places"("q" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."series_par_joueur"() RETURNS TABLE("user_id" "uuid", "jours" integer, "joue_aujourdhui" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with aujourd_hui as (
    select (now() at time zone 'Europe/Paris')::date as d
  ),
  jours_joues as (
    select distinct s.user_id, (s.played_at at time zone 'Europe/Paris')::date as d
      from scores s
  ),
  ranges as (
    select j.user_id, j.d,
           max(j.d) over (partition by j.user_id) as dernier,
           -- ::int, sinon row_number rend un bigint et « date - bigint »
           -- n'existe pas en PostgreSQL.
           (row_number() over (partition by j.user_id order by j.d desc) - 1)::int as k
      from jours_joues j
  )
  select r.user_id,
         -- La suite consécutive qui se termine au dernier jour joué : le rang
         -- k depuis la fin doit correspondre exactement à « dernier - k ».
         case when max(r.dernier) >= (select d from aujourd_hui) - 1
              then count(*) filter (where r.d = r.dernier - r.k)::integer
              else 0 end as jours,
         bool_or(r.dernier = (select d from aujourd_hui)) as joue_aujourdhui
    from ranges r
   where is_member()
   group by r.user_id
$$;


ALTER FUNCTION "public"."series_par_joueur"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."siblings"("target" "uuid") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "married_name" "text", "birth_display" "text", "death_display" "text", "deceased" boolean, "photo_url" "text", "sex" "text", "branch_id" integer, "kind" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_member() then
    raise exception 'acces refuse';
  end if;
  return query
    select s.id, s.first_name, s.last_name, s.married_name, s.birth_display,
           s.death_display, s.deceased, s.photo_url, s.sex, s.branch_id,
           case when s.father_id is not distinct from p.father_id
                 and s.mother_id is not distinct from p.mother_id
                then 'fratrie' else 'demi' end
    from people p
    join people s on s.id <> p.id
      and ( (s.father_id = p.father_id and p.father_id is not null)
         or (s.mother_id = p.mother_id and p.mother_id is not null) )
    where p.id = target
    order by s.birth_year nulls last, s.first_name;
end $$;


ALTER FUNCTION "public"."siblings"("target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_famille"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with n as (select coalesce((select niveau from mon_niveau()), 0) as niveau),
  -- 🔑 LA FAMILLE CONNUE commence à la génération d'Édouard Augustin Vernet,
  -- né en 1879 : c'est la plus ancienne dont quelqu'un de vivant ait entendu
  -- parler à table. Au-delà, l'import GEDCOM a versé quatre cent soixante-deux
  -- marchands de Hambourg et notaires genevois, et une page « la famille en
  -- chiffres » qui répond « Johann ×17 » ou « dix-sept enfants chez Garlieb
  -- Sillem » ne dit rien à personne — elle décrit une autre famille.
  --
  -- 🔑 Le repli par le décès moins soixante-dix ans rattrape ceux dont on n'a
  -- que la date de mort ; sans date du tout, on écarte, faute de pouvoir situer.
  --
  -- 🔑 Une seule exception plus bas : la plus longue lignée, qui n'a d'intérêt
  -- QUE si elle traverse les siècles. C'est le seul chiffre que les aïeux
  -- améliorent au lieu de le brouiller.
  famille as (
    select * from people where coalesce(birth_year, death_year - 70, 0) >= 1879
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'niveau', n.niveau,

    'compte', case when n.niveau >= 1 then jsonb_build_object(
      'personnes', (select count(*) from people),
      'vivants', (select count(*) from people where not deceased),
      'maisons', (select count(*) from places),
      'branches', (select count(distinct branch_id) from people where branch_id is not null),
      'photos', (select count(*) from people where photo_url is not null),
      'membres', (select count(*) from members),
      'aieux', (select count(*) from people where coalesce(birth_year, death_year - 70, 0) < 1879)
    ) end,

    'ages', case when n.niveau >= 2 then jsonb_build_object(
      'doyen', (select jsonb_build_object('id', id, 'nom', first_name || ' ' || last_name, 'annee', birth_year)
                  from people where not deceased and birth_year is not null
                 order by birth_year limit 1),
      'benjamin', (select jsonb_build_object('id', id, 'nom', first_name || ' ' || last_name, 'annee', birth_year)
                     from people where not deceased and birth_year is not null
                    order by birth_year desc limit 1),
      'moyenne', (select round(avg(extract(year from now()) - birth_year))
                    from people where not deceased and birth_year is not null),
      'plus_longue_vie', (select jsonb_build_object('id', id, 'nom', first_name || ' ' || last_name,
                                                    'ans', death_year - birth_year)
                            from famille where deceased and birth_year is not null and death_year is not null
                           order by death_year - birth_year desc limit 1)
    ) end,

    'prenoms', case when n.niveau >= 3 then jsonb_build_object(
      'donnes', (select jsonb_agg(x) from (
                   select split_part(first_name, ' ', 1) as prenom, count(*)::int as n
                     from famille group by 1 order by n desc, 1 limit 8) x),
      'disparus', (select jsonb_agg(y.prenom) from (
                     select split_part(first_name, ' ', 1) as prenom
                       from famille where birth_year is not null
                      group by 1 having max(birth_year) < 1950 and count(*) >= 2
                      order by count(*) desc, 1 limit 8) y),
      'traversant', (select jsonb_build_object('prenom', prenom, 'de', d, 'a', f, 'n', n) from (
                       select split_part(first_name, ' ', 1) as prenom, min(birth_year) d,
                              max(birth_year) f, count(*)::int n
                         from famille where birth_year is not null
                        group by 1 having count(*) >= 3
                        order by max(birth_year) - min(birth_year) desc limit 1) z)
    ) end,

    'calendrier', case when n.niveau >= 4 then jsonb_build_object(
      'mois', (select jsonb_agg(jsonb_build_object('mois', m, 'n', c) order by m) from (
                 select birth_month m, count(*)::int c from famille
                  where birth_month is not null group by 1) mm),
      'memes_jours', (select jsonb_agg(x) from (
                        select birth_day || '/' || birth_month as jour,
                               jsonb_agg(first_name || ' ' || last_name order by birth_year) as gens
                          from people
                         where birth_day is not null and birth_month is not null and not deceased
                         group by birth_day, birth_month
                        having count(*) > 1
                         order by count(*) desc, birth_month limit 5) x)
    ) end,

    'records', case when n.niveau >= 5 then jsonb_build_object(
      'fratrie', (select jsonb_build_object('n', f.n, 'pere', pe.first_name || ' ' || pe.last_name,
                                            'mere', me.first_name || ' ' || me.last_name)
                    from (select father_id, mother_id, count(*)::int n from famille
                           where father_id is not null group by 1, 2 order by n desc limit 1) f
                    left join people pe on pe.id = f.father_id
                    left join people me on me.id = f.mother_id),
      -- 🔑 L'exception annoncée : ici on repart de TOUT l'arbre. Une lignée qui
      -- s'arrête à l'arrière-grand-père n'est pas une lignée.
      'lignee', (select jsonb_build_object('nom', nom, 'n', prof) from (
                   with recursive depuis(id, prof, nom, vus) as (
                     select id, 1, first_name || ' ' || last_name, array[id] from people
                      where father_id is null and mother_id is null
                     union all
                     select p.id, d.prof + 1, p.first_name || ' ' || p.last_name, d.vus || p.id
                       from people p join depuis d on p.father_id = d.id or p.mother_id = d.id
                      where d.prof < 20 and not p.id = any(d.vus))
                   select nom, prof from depuis order by prof desc limit 1) l),
      'petits_enfants', (select jsonb_build_object('nom', nom, 'n', n) from (
                           select gp.first_name || ' ' || gp.last_name as nom,
                                  count(distinct pe.id)::int as n
                             from famille gp
                             join people c on c.father_id = gp.id or c.mother_id = gp.id
                             join people pe on pe.father_id = c.id or pe.mother_id = c.id
                            group by gp.id, gp.first_name, gp.last_name order by n desc, nom limit 1) g),
      'maison', (select jsonb_build_object('nom', pl.name, 'n', c.n) from (
                   select place_id, count(*)::int n from people
                    where place_id is not null group by 1 order by n desc limit 1) c
                   join places pl on pl.id = c.place_id)
    ) end
  ))
  from n where is_member()
$$;


ALTER FUNCTION "public"."stats_famille"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."visages_manquants"() RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "married_name" "text", "sex" "text", "birth_display" "text", "deceased" boolean, "branche" "text", "piste" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- 🔑 « Alice » ne dit rien à personne ; « Alice, épouse de Timothy
  -- Thornton » dit tout. Six personnes de l'arbre ne sont connues que par
  -- leur prénom, et cinquante-quatre n'ont pas de date : sans un repère,
  -- celui qui parcourt la liste ne sait pas de qui on lui parle, et passe.
  --
  -- 🔑 Le conjoint d'abord, les parents à défaut. Pour une pièce rapportée,
  -- c'est le mariage qui la situe ; pour un enfant sans conjoint, ce sont ses
  -- parents. Sur quatre cent quatre-vingt-dix-neuf visages manquants, quatre
  -- cent quatre-vingt-dix-sept reçoivent ainsi une piste.
  --
  -- 🔑 On ne propose jamais comme repère quelqu'un dont on ignore le nom : un
  -- « épouse de Pablo ? » n'aiderait personne.
  select p.id, p.first_name, p.last_name, p.married_name, p.sex,
         p.birth_display, p.deceased,
         b.name as branche,
         coalesce(
           (select case p.sex when 'F' then 'épouse ' when 'M' then 'époux ' else 'en couple avec ' end
                   || case when p.sex in ('F','M') then elide(c.first_name) else '' end
                   || c.first_name || ' ' || coalesce(c.married_name, c.last_name)
              from unions u
              join people c on c.id = case when u.p1_id = p.id then u.p2_id else u.p1_id end
             where p.id in (u.p1_id, u.p2_id)
               and c.last_name is not null and c.last_name <> '?'
             order by u.kind = 'mariage' desc
             limit 1),
           (select case p.sex when 'F' then 'fille ' when 'M' then 'fils ' else 'enfant ' end
                   || elide(coalesce(pe.first_name, me.first_name))
                   || coalesce(pe.first_name || ' ' || pe.last_name, '')
                   || case when pe.id is not null and me.id is not null then ' et ' else '' end
                   || coalesce(me.first_name || ' ' || coalesce(me.married_name, me.last_name), '')
              from people moi
              left join people pe on pe.id = moi.father_id
              left join people me on me.id = moi.mother_id
             where moi.id = p.id and (pe.id is not null or me.id is not null))
         ) as piste
    from people p
    left join branches b on b.id = p.branch_id
   where is_member()
     and p.collateral = false
     and p.photo_url is null
   order by p.deceased, p.last_name, p.first_name
$$;


ALTER FUNCTION "public"."visages_manquants"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."allowed_emails" (
    "email" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."allowed_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anecdotes" (
    "id" integer NOT NULL,
    "titre" "text" NOT NULL,
    "texte" "text" NOT NULL,
    "source" "text" NOT NULL,
    "person_id" "uuid",
    "place_id" integer,
    "ordre" integer DEFAULT 0 NOT NULL,
    "pour_camp" "text"
);


ALTER TABLE "public"."anecdotes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."anecdotes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."anecdotes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."anecdotes_id_seq" OWNED BY "public"."anecdotes"."id";



CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "row_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid" DEFAULT "auth"."uid"(),
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."branches_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."branches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."branches_id_seq" OWNED BY "public"."branches"."id";



CREATE TABLE IF NOT EXISTS "public"."duel_members" (
    "duel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."duel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" DEFAULT "substr"("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text"), 1, 6) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."duels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."familysearch_import" (
    "pid" "text" NOT NULL,
    "nom_complet" "text" NOT NULL,
    "ne" integer,
    "mort" integer,
    "sexe" "text",
    "source" "text",
    "person_id" "uuid",
    "releve_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."familysearch_import" OWNER TO "postgres";


COMMENT ON TABLE "public"."familysearch_import" IS 'Relevé FamilySearch (page descendance Vernet et Delcourt, 13/08/2026). Table de transit : rien n''entre dans people sans validation. Le pid est l''identifiant permanent FamilySearch.';



CREATE TABLE IF NOT EXISTS "public"."group_photos" (
    "id" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "source" "text" NOT NULL,
    "caption" "text" NOT NULL,
    "taken" "text"
);


ALTER TABLE "public"."group_photos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."group_photos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."group_photos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."group_photos_id_seq" OWNED BY "public"."group_photos"."id";



CREATE TABLE IF NOT EXISTS "public"."members" (
    "user_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "nom_declare" "text"
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "married_name" "text",
    "nickname" "text",
    "sex" "text",
    "father_id" "uuid",
    "mother_id" "uuid",
    "branch_id" integer,
    "birth_display" "text",
    "deceased" boolean DEFAULT false NOT NULL,
    "death_display" "text",
    "photo_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_text" "text" GENERATED ALWAYS AS ("public"."f_unaccent"("lower"((((("first_name" || ' '::"text") || "last_name") || COALESCE((' '::"text" || "married_name"), ''::"text")) || COALESCE((' '::"text" || "nickname"), ''::"text"))))) STORED,
    "birth_year" integer GENERATED ALWAYS AS ("public"."fam_year"("birth_display")) STORED,
    "death_year" integer GENERATED ALWAYS AS ("public"."fam_year"("death_display")) STORED,
    "place_id" integer,
    "place_detail" "text",
    "collateral" boolean DEFAULT false NOT NULL,
    "birth_day" integer GENERATED ALWAYS AS ("public"."fam_jour"("birth_display")) STORED,
    "birth_month" integer GENERATED ALWAYS AS ("public"."fam_mois"("birth_display")) STORED,
    "blason" "text",
    "birth_place" "text",
    "death_place" "text",
    "emoji" "text",
    "hors_quiz" boolean DEFAULT false NOT NULL,
    CONSTRAINT "people_emoji_liste" CHECK ((("emoji" IS NULL) OR ("emoji" = ANY (ARRAY['🌻'::"text", '🍇'::"text", '🌰'::"text", '🍑'::"text", '🌾'::"text", '🌳'::"text", '🐓'::"text", '🦆'::"text", '🐝'::"text", '🍄'::"text", '🏰'::"text", '⛪'::"text", '🐴'::"text", '🐑'::"text", '🌲'::"text", '🦋'::"text", '🥖'::"text", '🧀'::"text", '🍷'::"text", '🥘'::"text", '🍰'::"text", '☕'::"text", '🍯'::"text", '🫒'::"text", '🍓'::"text", '🥐'::"text", '🍺'::"text", '⚽'::"text", '🎾'::"text", '🏊'::"text", '🚴'::"text", '🥾'::"text", '⛵'::"text", '🎿'::"text", '🏇'::"text", '🎣'::"text", '🧘'::"text", '🏉'::"text", '🏄'::"text", '🏃'::"text", '🚣'::"text", '📚'::"text", '🎨'::"text", '🎭'::"text", '🎸'::"text", '🎹'::"text", '🎤'::"text", '📷'::"text", '🎬'::"text", '♟️'::"text", '🧶'::"text", '🪴'::"text", '🍳'::"text", '🎻'::"text", '🥁'::"text", '🎮'::"text", '🌍'::"text", '✍️'::"text", '⚕️'::"text", '⚖️'::"text", '🔧'::"text", '🧪'::"text", '💻'::"text", '✈️'::"text", '🚜'::"text", '🏗️'::"text", '📐'::"text", '🎓'::"text", '💼'::"text", '🔬'::"text", '🌱'::"text", '🦉'::"text", '🐢'::"text", '🦊'::"text", '🐿️'::"text", '🦁'::"text", '🐻'::"text", '🐇'::"text"])))),
    CONSTRAINT "people_not_own_parent" CHECK ((("id" <> "father_id") AND ("id" <> "mother_id"))),
    CONSTRAINT "people_sex_check" CHECK (("sex" = ANY (ARRAY['M'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."people" OWNER TO "postgres";


COMMENT ON COLUMN "public"."people"."emoji" IS 'Emblème choisi dans une liste fermée. Complète la photo, ne la remplace pas.';



COMMENT ON COLUMN "public"."people"."hors_quiz" IS 'La fiche reste dans l''annuaire, la recherche et l''arbre, mais le quiz ne la propose jamais — ni comme question, ni comme mauvaise réponse. Posé à la demande.';



CREATE TABLE IF NOT EXISTS "public"."photo_candidates" (
    "id" integer NOT NULL,
    "person_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "source_site" "text" NOT NULL,
    "source_title" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "why" "text",
    "refused_by" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "confiance" "text" DEFAULT 'douteux'::"text" NOT NULL,
    CONSTRAINT "photo_candidates_confiance_check" CHECK (("confiance" = ANY (ARRAY['sûr'::"text", 'plausible'::"text", 'douteux'::"text", 'alerte'::"text"])))
);


ALTER TABLE "public"."photo_candidates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."photo_candidates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."photo_candidates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."photo_candidates_id_seq" OWNED BY "public"."photo_candidates"."id";



CREATE TABLE IF NOT EXISTS "public"."photo_marks" (
    "id" bigint NOT NULL,
    "photo_id" bigint NOT NULL,
    "person_id" "uuid",
    "x" real NOT NULL,
    "y" real NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "named_by" "uuid",
    "named_at" timestamp with time zone,
    CONSTRAINT "photo_marks_x_check" CHECK ((("x" >= (0)::double precision) AND ("x" <= (1)::double precision))),
    CONSTRAINT "photo_marks_y_check" CHECK ((("y" >= (0)::double precision) AND ("y" <= (1)::double precision)))
);


ALTER TABLE "public"."photo_marks" OWNER TO "postgres";


COMMENT ON TABLE "public"."photo_marks" IS 'Repères « qui est qui » sur une photo de groupe. Hors du journal d''audit : row_id y est un uuid, un repère a un id numérique. La traçabilité tient dans created_by / named_by / named_at.';



CREATE SEQUENCE IF NOT EXISTS "public"."photo_marks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."photo_marks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."photo_marks_id_seq" OWNED BY "public"."photo_marks"."id";



CREATE TABLE IF NOT EXISTS "public"."photo_tasks" (
    "id" integer NOT NULL,
    "photo_id" integer NOT NULL,
    "person_id" "uuid" NOT NULL,
    "position" "text",
    "passed_by" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL
);


ALTER TABLE "public"."photo_tasks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."photo_tasks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."photo_tasks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."photo_tasks_id_seq" OWNED BY "public"."photo_tasks"."id";



CREATE TABLE IF NOT EXISTS "public"."place_stories" (
    "id" bigint NOT NULL,
    "place_id" integer NOT NULL,
    "texte" "text" NOT NULL,
    "auteur" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "place_stories_texte_check" CHECK ((("length"(TRIM(BOTH FROM "texte")) >= 10) AND ("length"(TRIM(BOTH FROM "texte")) <= 2000)))
);


ALTER TABLE "public"."place_stories" OWNER TO "postgres";


ALTER TABLE "public"."place_stories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."place_stories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "occupants" "text",
    "outside" boolean DEFAULT false NOT NULL,
    "note" "text",
    "lat" double precision,
    "lon" double precision,
    "commune" "text",
    "geo_precision" "text",
    "geo_source" "text",
    "resume" "text",
    "histoire" "text",
    "histoire_source" "text",
    CONSTRAINT "places_geo_precision_check" CHECK (("geo_precision" = ANY (ARRAY['exact'::"text", 'approximatif'::"text"])))
);


ALTER TABLE "public"."places" OWNER TO "postgres";


COMMENT ON COLUMN "public"."places"."resume" IS 'Dix lignes maximum : ce qu''on lit avant de décider si on veut la suite.';



COMMENT ON COLUMN "public"."places"."histoire_source" IS 'D''où vient le récit — « La Gazette n° 12, mars 2019 », un nom, une date.';



CREATE SEQUENCE IF NOT EXISTS "public"."places_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."places_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."places_id_seq" OWNED BY "public"."places"."id";



CREATE TABLE IF NOT EXISTS "public"."remerciements" (
    "id" bigint NOT NULL,
    "quoi" "text" NOT NULL,
    "qui" "text" NOT NULL,
    "quand" "text",
    "ordre" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "person_ids" "uuid"[]
);


ALTER TABLE "public"."remerciements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."remerciements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."remerciements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."remerciements_id_seq" OWNED BY "public"."remerciements"."id";



CREATE TABLE IF NOT EXISTS "public"."scores" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pseudo" "text" NOT NULL,
    "score" integer NOT NULL,
    "justes" integer NOT NULL,
    "total" integer NOT NULL,
    "played_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branche" "text",
    CONSTRAINT "scores_justes_check" CHECK (("justes" >= 0)),
    CONSTRAINT "scores_pseudo_check" CHECK ((("length"(TRIM(BOTH FROM "pseudo")) >= 1) AND ("length"(TRIM(BOTH FROM "pseudo")) <= 24))),
    CONSTRAINT "scores_score_check" CHECK (("score" >= 0)),
    CONSTRAINT "scores_total_check" CHECK (("total" > 0))
);


ALTER TABLE "public"."scores" OWNER TO "postgres";


ALTER TABLE "public"."scores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."scores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."unions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "p1_id" "uuid" NOT NULL,
    "p2_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'mariage'::"text" NOT NULL,
    "date_display" "text",
    CONSTRAINT "unions_distinct" CHECK (("p1_id" <> "p2_id")),
    CONSTRAINT "unions_kind_check" CHECK (("kind" = ANY (ARRAY['mariage'::"text", 'union'::"text", 'separe'::"text"])))
);


ALTER TABLE "public"."unions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anecdotes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."anecdotes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."branches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."branches_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."group_photos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."group_photos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."photo_candidates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."photo_candidates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."photo_marks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."photo_marks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."photo_tasks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."photo_tasks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."places" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."places_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."remerciements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."remerciements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."allowed_emails"
    ADD CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."anecdotes"
    ADD CONSTRAINT "anecdotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duel_members"
    ADD CONSTRAINT "duel_members_pkey" PRIMARY KEY ("duel_id", "user_id");



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."familysearch_import"
    ADD CONSTRAINT "familysearch_import_pkey" PRIMARY KEY ("pid");



ALTER TABLE ONLY "public"."group_photos"
    ADD CONSTRAINT "group_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_candidates"
    ADD CONSTRAINT "photo_candidates_person_id_storage_path_key" UNIQUE ("person_id", "storage_path");



ALTER TABLE ONLY "public"."photo_candidates"
    ADD CONSTRAINT "photo_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_marks"
    ADD CONSTRAINT "photo_marks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_tasks"
    ADD CONSTRAINT "photo_tasks_photo_id_person_id_key" UNIQUE ("photo_id", "person_id");



ALTER TABLE ONLY "public"."photo_tasks"
    ADD CONSTRAINT "photo_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_stories"
    ADD CONSTRAINT "place_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."remerciements"
    ADD CONSTRAINT "remerciements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scores"
    ADD CONSTRAINT "scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unions"
    ADD CONSTRAINT "unions_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_row_idx" ON "public"."audit_log" USING "btree" ("row_id", "changed_at" DESC);



CREATE INDEX "idx_members_person" ON "public"."members" USING "btree" ("person_id");



CREATE INDEX "idx_photo_tasks_person" ON "public"."photo_tasks" USING "btree" ("person_id");



CREATE INDEX "idx_place_stories_user" ON "public"."place_stories" USING "btree" ("user_id");



CREATE INDEX "idx_scores_user" ON "public"."scores" USING "btree" ("user_id");



CREATE INDEX "people_anniversaire" ON "public"."people" USING "btree" ("birth_month", "birth_day") WHERE ("birth_month" IS NOT NULL);



CREATE INDEX "people_birth_year_idx" ON "public"."people" USING "btree" ("birth_year");



CREATE INDEX "people_branch_idx" ON "public"."people" USING "btree" ("branch_id");



CREATE INDEX "people_father_idx" ON "public"."people" USING "btree" ("father_id");



CREATE INDEX "people_mother_idx" ON "public"."people" USING "btree" ("mother_id");



CREATE INDEX "people_place_idx" ON "public"."people" USING "btree" ("place_id");



CREATE INDEX "people_search_idx" ON "public"."people" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "photo_marks_person" ON "public"."photo_marks" USING "btree" ("person_id");



CREATE INDEX "photo_marks_photo" ON "public"."photo_marks" USING "btree" ("photo_id");



CREATE UNIQUE INDEX "photo_marks_une_fois" ON "public"."photo_marks" USING "btree" ("photo_id", "person_id") WHERE ("person_id" IS NOT NULL);



CREATE INDEX "place_stories_place" ON "public"."place_stories" USING "btree" ("place_id", "created_at" DESC);



CREATE INDEX "scores_meilleur" ON "public"."scores" USING "btree" ("score" DESC, "played_at");



CREATE INDEX "unions_p1_idx" ON "public"."unions" USING "btree" ("p1_id");



CREATE INDEX "unions_p2_idx" ON "public"."unions" USING "btree" ("p2_id");



CREATE UNIQUE INDEX "unions_pair_idx" ON "public"."unions" USING "btree" (LEAST("p1_id", "p2_id"), GREATEST("p1_id", "p2_id"));



CREATE OR REPLACE TRIGGER "allowed_emails_audit" AFTER INSERT OR DELETE ON "public"."allowed_emails" FOR EACH ROW EXECUTE FUNCTION "public"."audit_allowed_emails"();



CREATE OR REPLACE TRIGGER "people_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "people_photo_audit" AFTER UPDATE OF "photo_url" ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "people_place_audit" AFTER UPDATE OF "place_id", "place_detail" ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "places_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."places" FOR EACH ROW EXECUTE FUNCTION "public"."audit_places"();



CREATE OR REPLACE TRIGGER "unions_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."unions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



ALTER TABLE ONLY "public"."anecdotes"
    ADD CONSTRAINT "anecdotes_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anecdotes"
    ADD CONSTRAINT "anecdotes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duel_members"
    ADD CONSTRAINT "duel_members_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "public"."duels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duel_members"
    ADD CONSTRAINT "duel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."duels"
    ADD CONSTRAINT "duels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."familysearch_import"
    ADD CONSTRAINT "familysearch_import_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_father_id_fkey" FOREIGN KEY ("father_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."photo_candidates"
    ADD CONSTRAINT "photo_candidates_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_marks"
    ADD CONSTRAINT "photo_marks_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_marks"
    ADD CONSTRAINT "photo_marks_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."group_photos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_tasks"
    ADD CONSTRAINT "photo_tasks_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_tasks"
    ADD CONSTRAINT "photo_tasks_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."group_photos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_stories"
    ADD CONSTRAINT "place_stories_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_stories"
    ADD CONSTRAINT "place_stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scores"
    ADD CONSTRAINT "scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unions"
    ADD CONSTRAINT "unions_p1_id_fkey" FOREIGN KEY ("p1_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unions"
    ADD CONSTRAINT "unions_p2_id_fkey" FOREIGN KEY ("p2_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



CREATE POLICY "allowed_del" ON "public"."allowed_emails" FOR DELETE USING ("public"."is_admin"());



ALTER TABLE "public"."allowed_emails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allowed_ins" ON "public"."allowed_emails" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "allowed_read" ON "public"."allowed_emails" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."anecdotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_read_fiches" ON "public"."audit_log" FOR SELECT USING (("public"."is_member"() AND ("table_name" = ANY (ARRAY['people'::"text", 'unions'::"text"]))));



CREATE POLICY "audit_read_tout" ON "public"."audit_log" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_ins" ON "public"."branches" FOR INSERT WITH CHECK ("public"."is_member"());



CREATE POLICY "branches_read" ON "public"."branches" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "chacun depose ses parties" ON "public"."scores" FOR INSERT WITH CHECK (("public"."is_member"() AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "chacun ecrit le sien" ON "public"."place_stories" FOR INSERT WITH CHECK (("public"."is_member"() AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "chacun efface le sien" ON "public"."place_stories" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "chacun modifie le sien" ON "public"."place_stories" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."duel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."duels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."familysearch_import" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_photos_del" ON "public"."group_photos" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "group_photos_ins" ON "public"."group_photos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_member"());



CREATE POLICY "group_photos_read" ON "public"."group_photos" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "la famille consulte le relevé" ON "public"."familysearch_import" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "la famille lit les remerciements" ON "public"."remerciements" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "les gardiens creditent" ON "public"."remerciements" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "les gardiens écrivent le relevé" ON "public"."familysearch_import" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "les membres lisent le releve" ON "public"."familysearch_import" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "les membres lisent les anecdotes" ON "public"."anecdotes" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "les membres lisent les souvenirs" ON "public"."place_stories" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "les membres nomment les reperes" ON "public"."photo_marks" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());



CREATE POLICY "les membres posent des reperes" ON "public"."photo_marks" FOR INSERT WITH CHECK ("public"."is_member"());



CREATE POLICY "les membres voient les reperes" ON "public"."photo_marks" FOR SELECT USING ("public"."is_member"());



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_self" ON "public"."members" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "members_upd" ON "public"."members" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "membres lisent le classement" ON "public"."scores" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "membres voient les participants de leurs duels" ON "public"."duel_members" FOR SELECT USING (("public"."is_member"() AND (EXISTS ( SELECT 1
   FROM "public"."duel_members" "dm2"
  WHERE (("dm2"."duel_id" = "duel_members"."duel_id") AND ("dm2"."user_id" = "auth"."uid"()))))));



CREATE POLICY "membres voient leurs duels" ON "public"."duels" FOR SELECT USING (("public"."is_member"() AND (("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."duel_members" "dm"
  WHERE (("dm"."duel_id" = "duels"."id") AND ("dm"."user_id" = "auth"."uid"())))))));



CREATE POLICY "on efface ce qu'on a pose" ON "public"."photo_marks" FOR DELETE USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "people_del" ON "public"."people" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "people_ins" ON "public"."people" FOR INSERT WITH CHECK ("public"."is_member"());



CREATE POLICY "people_read" ON "public"."people" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "people_upd" ON "public"."people" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());



ALTER TABLE "public"."photo_candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "photo_candidates_read" ON "public"."photo_candidates" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "photo_candidates_refuse" ON "public"."photo_candidates" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());



ALTER TABLE "public"."photo_marks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "photo_tasks_del" ON "public"."photo_tasks" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "photo_tasks_ins" ON "public"."photo_tasks" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_member"());



CREATE POLICY "photo_tasks_pass" ON "public"."photo_tasks" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());



CREATE POLICY "photo_tasks_read" ON "public"."photo_tasks" FOR SELECT USING ("public"."is_member"());



ALTER TABLE "public"."place_stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "places_delete" ON "public"."places" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "places_ins" ON "public"."places" FOR INSERT WITH CHECK ("public"."is_member"());



CREATE POLICY "places_read" ON "public"."places" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "places_upd" ON "public"."places" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());



ALTER TABLE "public"."remerciements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "un membre peut ajouter au duel" ON "public"."duel_members" FOR INSERT WITH CHECK (("public"."is_member"() AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."duels" "d"
  WHERE (("d"."id" = "duel_members"."duel_id") AND ("d"."created_by" = "auth"."uid"())))))));



CREATE POLICY "un membre peut creer un duel" ON "public"."duels" FOR INSERT WITH CHECK (("public"."is_member"() AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."unions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unions_del" ON "public"."unions" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "unions_ins" ON "public"."unions" FOR INSERT WITH CHECK ("public"."is_member"());



CREATE POLICY "unions_read" ON "public"."unions" FOR SELECT USING ("public"."is_member"());



CREATE POLICY "unions_upd" ON "public"."unions" FOR UPDATE USING ("public"."is_member"()) WITH CHECK ("public"."is_member"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."anecdote_du_jour"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anecdote_du_jour"() TO "anon";
GRANT ALL ON FUNCTION "public"."anecdote_du_jour"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."anecdote_du_jour"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."anniversaires"("fenetre" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anniversaires"("fenetre" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."anniversaires"("fenetre" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."arrivees"("jours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."arrivees"("jours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."arrivees"("jours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_allowed_emails"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_places"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."audit_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."camp_de"("branche" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."camp_de"("branche" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."camp_de"("branche" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."chercher_ailleurs"("q" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chercher_ailleurs"("q" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."classement"("combien" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."classement"("combien" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."classement_branches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."classement_branches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."classement_branches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."classement_camps"() TO "anon";
GRANT ALL ON FUNCTION "public"."classement_camps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."classement_camps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."classement_du_jour"("combien" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."classement_du_jour"("combien" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."classement_duel"("code_duel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."classement_duel"("code_duel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."classement_duel"("code_duel" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."contributeurs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."contributeurs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."contributeurs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."defi_semaine"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."defi_semaine"() TO "service_role";



GRANT ALL ON FUNCTION "public"."duel_par_code"("code_duel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."duel_par_code"("code_duel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duel_par_code"("code_duel" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."elide"("prenom" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."elide"("prenom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."elide"("prenom" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."exporter_migrations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."exporter_migrations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."exporter_migrations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."f_unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."f_unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."f_unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."indice_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."indice_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."indice_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."inviter_membre"("nouvel_email" "text", "qui" "text", "secret" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."inviter_membre"("nouvel_email" "text", "qui" "text", "secret" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inviter_membre"("nouvel_email" "text", "qui" "text", "secret" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_member"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_family"("code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_family"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_family"("code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."joueurs_actifs"() TO "anon";
GRANT ALL ON FUNCTION "public"."joueurs_actifs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."joueurs_actifs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."journal_famille"("depuis_jours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."journal_famille"("depuis_jours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."journal_famille"("depuis_jours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ma_serie"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ma_serie"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."me_declarer"("nom" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."me_declarer"("nom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."me_declarer"("nom" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mes_premiers_pas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mes_premiers_pas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mon_niveau"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mon_niveau"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."parente"("cible" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."parente"("cible" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parente"("cible" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."parente_entre"("cible" "uuid", "moi" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."parente_entre"("cible" "uuid", "moi" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."passer_tache"("tache" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."passer_tache"("tache" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."passer_tache"("tache" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fam_jour"("display" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fam_jour"("display" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fam_jour"("display" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fam_mois"("display" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fam_mois"("display" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fam_mois"("display" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fam_year"("display" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fam_year"("display" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fam_year"("display" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."photos_de_groupe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photos_de_groupe"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refuser_candidat"("candidat" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refuser_candidat"("candidat" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refuser_candidat"("candidat" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."regler_acces"("nouveau_code" "text", "ouvert" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."regler_acces"("nouveau_code" "text", "ouvert" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."regler_acces"("nouveau_code" "text", "ouvert" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rejoindre_avec_code"("mon_email" "text", "code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restaurer_fiche"("audit_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restaurer_fiche"("audit_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."restaurer_fiche"("audit_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_people"("q" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_people"("q" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_people"("q" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_places"("q" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_places"("q" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_places"("q" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."series_par_joueur"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."series_par_joueur"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."siblings"("target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."siblings"("target" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."siblings"("target" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_famille"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_famille"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."visages_manquants"() TO "anon";
GRANT ALL ON FUNCTION "public"."visages_manquants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."visages_manquants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."allowed_emails" TO "anon";
GRANT ALL ON TABLE "public"."allowed_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."allowed_emails" TO "service_role";



GRANT ALL ON TABLE "public"."anecdotes" TO "anon";
GRANT ALL ON TABLE "public"."anecdotes" TO "authenticated";
GRANT ALL ON TABLE "public"."anecdotes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."anecdotes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."anecdotes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."anecdotes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."duel_members" TO "anon";
GRANT ALL ON TABLE "public"."duel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."duel_members" TO "service_role";



GRANT ALL ON TABLE "public"."duels" TO "anon";
GRANT ALL ON TABLE "public"."duels" TO "authenticated";
GRANT ALL ON TABLE "public"."duels" TO "service_role";



GRANT ALL ON TABLE "public"."familysearch_import" TO "anon";
GRANT ALL ON TABLE "public"."familysearch_import" TO "authenticated";
GRANT ALL ON TABLE "public"."familysearch_import" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."group_photos" TO "anon";
GRANT ALL ON TABLE "public"."group_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."group_photos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."group_photos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."group_photos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."group_photos_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT UPDATE("person_id") ON TABLE "public"."members" TO "authenticated";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT UPDATE("blason") ON TABLE "public"."people" TO "authenticated";



GRANT UPDATE("birth_place") ON TABLE "public"."people" TO "authenticated";



GRANT UPDATE("death_place") ON TABLE "public"."people" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."photo_candidates" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."photo_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_candidates" TO "service_role";



GRANT UPDATE("refused_by") ON TABLE "public"."photo_candidates" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."photo_candidates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."photo_candidates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."photo_candidates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."photo_marks" TO "anon";
GRANT ALL ON TABLE "public"."photo_marks" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_marks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."photo_marks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."photo_marks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."photo_marks_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."photo_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."photo_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_tasks" TO "service_role";



GRANT UPDATE("passed_by") ON TABLE "public"."photo_tasks" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."photo_tasks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."photo_tasks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."photo_tasks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."place_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."place_stories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."place_stories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."place_stories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."place_stories_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."places" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON SEQUENCE "public"."places_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."places_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."places_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."remerciements" TO "anon";
GRANT ALL ON TABLE "public"."remerciements" TO "authenticated";
GRANT ALL ON TABLE "public"."remerciements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."remerciements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."remerciements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."remerciements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."scores" TO "anon";
GRANT ALL ON TABLE "public"."scores" TO "authenticated";
GRANT ALL ON TABLE "public"."scores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."scores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."unions" TO "anon";
GRANT ALL ON TABLE "public"."unions" TO "authenticated";
GRANT ALL ON TABLE "public"."unions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































