-- ============================================================
--  FIXLY — 0029: conserta o upload da foto de perfil
--
--  SINTOMA: "Erro ao enviar a foto: new row violates row-level security
--  policy", tanto no computador quanto no celular.
--
--  CAUSA: o upload do avatar usa `upsert: true`. Nesse modo o Storage precisa
--  primeiro DESCOBRIR se o objeto já existe — e o bucket `avatars` tinha
--  policies de insert/update/delete, mas **nenhuma de SELECT**. Sem enxergar a
--  linha, o Storage cai no caminho de inserção, esbarra no objeto existente e
--  devolve justamente o erro de RLS. (Por isso o portfólio, que sobe sem
--  upsert, nunca deu problema.)
--
--  O bucket é PÚBLICO — a foto já é vitrine, aparece nas propostas e no
--  perfil. Liberar o SELECT não expõe nada que a internet já não veja.
-- ============================================================

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

-- Mesma armadilha esperando o portfólio: hoje ele sobe sem upsert, mas basta
-- alguém trocar para `upsert: true` para reproduzir o bug. É bucket público.
drop policy if exists portfolio_read on storage.objects;
create policy portfolio_read on storage.objects for select
  using (bucket_id = 'portfolio');
