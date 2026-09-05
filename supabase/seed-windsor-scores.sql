-- Scores fictifs pour la démo publique : un classement vide ne donne envie à
-- personne. Seize joueurs inventés, chacun rattaché à une branche, avec des
-- parties étalées sur les dix derniers jours (donc quelques séries 🔥).
-- Rejouable : les comptes sont reconnus par leur adresse `joueur-N@demo.invalid`.
-- À charger APRÈS seed-windsor.sql (les branches doivent exister).

do $$
declare
  joueurs text[][] := array[
    ['Margaux',  'Prusse'],
    ['Théo',     'Prusse'],
    ['Inès',     'Hesse'],
    ['Gabriel',  'Hesse'],
    ['Louise',   'Cobourg'],
    ['Adrien',   'Cobourg'],
    ['Camille',  'Édouard VII'],
    ['Raphaël',  'Édouard VII'],
    ['Zoé',      'Albany'],
    ['Hugo',     'Connaught'],
    ['Alice',    'Connaught'],
    ['Nathan',   'Battenberg'],
    ['Léa',      'Schleswig-Holstein'],
    ['Jules',    'Argyll'],
    ['Sarah',    'Les invités'],
    ['Mehdi',    'Les invités']
  ];
  -- Meilleur score de chaque joueur (10 questions : 100 + rapidité, série ×2 au mieux).
  sommets int[] := array[1840, 1710, 1650, 1590, 1520, 1480, 1460, 1390, 1310, 1240, 1180, 1120, 980, 860, 1350, 720];
  -- Nombre de jours joués, en remontant depuis aujourd'hui (série).
  jours int[] := array[6, 2, 4, 1, 3, 1, 5, 2, 1, 3, 1, 2, 1, 1, 2, 1];
  i int; j int;
  addr text; uid uuid; pseudo text; branche text; pic int; sc int;
begin
  for i in 1 .. array_length(joueurs, 1) loop
    pseudo := joueurs[i][1];
    branche := joueurs[i][2];
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
    insert into members(user_id, nom_declare) values (uid, pseudo) on conflict (user_id) do nothing;

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

select count(distinct user_id) as joueurs, count(*) as parties, count(distinct branche) as branches from scores;
