-- 0002_storage — bucket privé des photos

-- Bucket privé : une URL de photo qui fuite ne doit rien donner à qui n'est pas
-- membre. L'accès passe par des liens signés à durée limitée, générés à
-- l'affichage, jamais par une URL publique stable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visages', 'visages', false, 3145728,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "visages lisibles par la famille"
  on storage.objects for select
  using (bucket_id = 'visages' and is_member());

create policy "visages deposables par la famille"
  on storage.objects for insert
  with check (bucket_id = 'visages' and is_member());

create policy "visages remplacables par la famille"
  on storage.objects for update
  using (bucket_id = 'visages' and is_member())
  with check (bucket_id = 'visages' and is_member());

create policy "visages supprimables par la famille"
  on storage.objects for delete
  using (bucket_id = 'visages' and is_member());
