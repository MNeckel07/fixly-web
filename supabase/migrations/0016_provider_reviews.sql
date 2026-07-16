-- ============================================================
--  FIXLY — Avaliações públicas de um prestador (para o Profiler)
-- ============================================================
create or replace function public.get_provider_reviews(p_provider uuid, p_limit int default 10)
returns table (rating int, review text, created_at timestamptz, category text)
language sql security definer set search_path = public stable as $$
  select r.rating, r.review, r.created_at, c.name
  from public.service_requests r
  left join public.service_categories c on c.id = r.category_id
  where r.provider_id = p_provider
    and r.review is not null
    and r.rating is not null
  order by r.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.get_provider_reviews(uuid, int) to anon, authenticated;
