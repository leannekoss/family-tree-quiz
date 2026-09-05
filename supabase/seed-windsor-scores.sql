-- Scores fictifs pour la démo publique : un classement vide ne donne envie à
-- personne. Des « vrais faux joueurs » : des membres de l'arbre (William, Harry,
-- Meghan, Felipe…) rattachés à leur fiche, donc avec photo et emblème au
-- tableau, plus quelques invités sans fiche. Parties étalées sur dix jours
-- (donc quelques séries 🔥). Rejouable : les comptes sont reconnus par leur
-- adresse `joueur-N@demo.invalid`. À charger APRÈS seed-windsor.sql.
--
-- Colonnes : pseudo · branche jouée · id de la fiche (vide = invité) · emblème
-- (vide = aucun ; doit figurer dans la liste `people_emoji_liste`).

do $$
declare
  joueurs text[][] := array[
    -- Les Windsor (branche Édouard VII) : Anne devant tout le monde, Catherine
    -- devant William, Harry devant Meghan, Andrew bon dernier.
    ['Anne',       'Édouard VII', '84df0dbf-9642-57e3-a398-c92b983c5292', '🐴'],
    ['Catherine',  'Édouard VII', 'ed1caa32-592e-50aa-9089-26ef635b45d7', '📷'],
    ['Harry',      'Édouard VII', 'ded513be-7b2e-5e1a-9dc9-2c0fe833b5d0', '🎮'],
    ['Meghan',     'Édouard VII', '8a6d20b9-5a55-555d-a97e-5f3b1c78c460', '🍳'],
    ['William',    'Édouard VII', '4f8dd984-e5db-5c2a-9c1c-06bed731b188', '🏉'],
    ['Charlotte',  'Édouard VII', 'e4b31a54-75fd-5b3f-b353-14a389713868', '🎾'],
    ['George',     'Édouard VII', '80fc5052-22e9-5040-b955-411744229d49', '⚽'],
    ['Charles',    'Édouard VII', 'd4394660-4ade-52ff-8825-6c1ca13c97da', '🪴'],
    ['Andrew',     'Édouard VII', '33c2a4bb-e5bf-5111-a993-7ed55a0e9f33', '⛵'],
    -- Hesse
    ['Beatrice',   'Hesse',       '687cb6a4-c178-5e98-a9c7-ce0411e16755', '📚'],
    ['Eugenie',    'Hesse',       '7f4a4602-cc27-5b05-900d-ddccd706e352', '🎨'],
    -- Battenberg : les Bourbons d'Espagne
    ['Felipe',     'Battenberg',  '031f757a-2df3-5884-9a17-666bc2b08bcf', '⛵'],
    ['Leonor',     'Battenberg',  'e7560065-a7af-5c1d-ae68-a4628fc05e2f', '🎓'],
    -- Connaught : Danemark et Suède
    ['Frederik',   'Connaught',   'f43c926c-366d-5bbf-ab27-2ec9f1eb236a', '🏃'],
    ['Victoria',   'Connaught',   'd1f77140-7b31-5155-b96c-8132e54d616f', '🥾'],
    ['Carl Philip','Connaught',   'adee3427-1c35-5aec-81ac-91a776e353e0', '🚴'],
    -- Prusse : la branche grecque et les Hohenzollern
    ['Pavlos',     'Prusse',      '1c17e994-90e8-51a6-9852-70e9dc2a171e', '🎓'],
    ['Theodora',   'Prusse',      '0a77bd01-8ce9-5890-8f86-ea40e0a82b6f', '🎭'],
    ['Georg',      'Prusse',      '56c8cb4b-c14e-5015-b189-360a7d7935e0', '🏰'],
    -- Cobourg, Albany
    ['Maria',      'Cobourg',     '83ce8dab-70b4-56ec-8e14-7ece5e9070a6', '⚖️'],
    ['Filip',      'Cobourg',     'f17cdd44-4da9-5b26-a034-e645a3831112', '💼'],
    ['Ian',        'Albany',      '1d61200a-a310-5800-bcff-e8eb4a098626', '🚜'],
    -- Les invités : des visiteurs comme ceux de la démo, sans fiche
    ['Sarah',      'Les invités', '', ''],
    ['Mehdi',      'Les invités', '', ''],
    ['Léa',        'Les invités', '', ''],
    ['Jules',      'Les invités', '', '']
  ];
  -- Meilleur score de chaque joueur (10 questions : 100 + rapidité, série ×2 au mieux).
  sommets int[] := array[1840, 1780, 1710, 1650, 1590, 1390, 1310, 1120, 860,
                         1460, 1240,
                         1720, 1180,
                         1520, 1480, 1090,
                         1350, 1010, 940,
                         1270, 890, 780,
                         1430, 1160, 970, 720];
  -- Nombre de jours joués, en remontant depuis aujourd'hui (série).
  jours int[] := array[6, 3, 4, 2, 2, 1, 1, 1, 1,
                       3, 1,
                       5, 1,
                       2, 3, 1,
                       2, 1, 1,
                       1, 1, 1,
                       4, 2, 1, 1];
  i int; j int;
  addr text; uid uuid; pseudo text; branche text; fiche uuid; embleme text; pic int; sc int;
begin
  for i in 1 .. array_length(joueurs, 1) loop
    pseudo := joueurs[i][1];
    branche := joueurs[i][2];
    embleme := nullif(joueurs[i][4], '');
    fiche := nullif(joueurs[i][3], '')::uuid;
    if fiche is not null and not exists (select 1 from people where id = fiche) then
      raise exception 'fiche introuvable pour %', pseudo;
    end if;
    addr := 'joueur-' || i || '@demo.invalid';
    pic := sommets[i];

    select id into uid from auth.users where email = addr;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users(
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        addr, crypt('windsor', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('sub', uid::text, 'email', addr, 'email_verified', true, 'phone_verified', false),
        '', '', '', '', '', '', '', ''
      );
      insert into auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid::text, uid,
              jsonb_build_object('sub', uid::text, 'email', addr, 'email_verified', true, 'phone_verified', false),
              'email', now(), now(), now());
    end if;

    insert into allowed_emails(email, note) values (addr, 'joueur fictif de la démo') on conflict (email) do nothing;
    insert into members(user_id, nom_declare, person_id) values (uid, pseudo, fiche)
      on conflict (user_id) do update set nom_declare = excluded.nom_declare, person_id = excluded.person_id;
    if fiche is not null then
      update people set emoji = embleme where id = fiche;
    end if;

    delete from scores where user_id = uid;
    -- Une partie par jour joué ; la meilleure est la plus récente, les autres
    -- descendent par paliers pour que le classement du jour bouge aussi.
    for j in 0 .. jours[i] - 1 loop
      sc := pic - j * (60 + (i * 7) % 50);
      insert into scores(user_id, pseudo, score, justes, total, played_at, branche)
      values (uid, pseudo, sc, least(10, greatest(4, sc / 170)), 10,
              now() - (j || ' days')::interval - ((i * 37) % 600 || ' minutes')::interval,
              branche);
    end loop;
  end loop;
end $$;

select count(distinct s.user_id) as joueurs, count(*) as parties, count(distinct s.branche) as branches,
       count(distinct m.person_id) as avec_fiche, count(distinct p.emoji) as emblemes
  from scores s left join members m on m.user_id = s.user_id left join people p on p.id = m.person_id;
