-- ============================================================
--  FIXLY — Categorias de reforma/obra + avaliação escrita
-- ============================================================

-- Novas categorias (mantém as 8 originais)
insert into public.service_categories (slug, name, icon, color, base_price) values
  ('alvenaria',         'Alvenaria',            'brick', '#B45309', 150),
  ('carpintaria',       'Carpintaria',          'axe',   '#92400E', 120),
  ('armador',           'Armador',              'frame', '#6B7280', 130),
  ('pisos',             'Pisos e revestimentos','grid',  '#0EA5E9', 140),
  ('gesso',             'Gesso e drywall',      'stack', '#9CA3AF', 130),
  ('telhados',          'Telhados',             'roof',  '#DC2626', 160),
  ('esquadrias',        'Esquadrias',           'door',  '#7C3AED', 140),
  ('vidracaria',        'Vidraçaria',           'glass', '#0891B2', 130),
  ('marcenaria',        'Marcenaria',           'ruler', '#A16207', 150),
  ('serralheria',       'Serralheria',          'fence', '#4B5563', 150),
  ('impermeabilizacao', 'Impermeabilização',    'water', '#2563EB', 160),
  ('fachadas',          'Fachadas',             'facade','#DB2777', 170),
  ('banheiros',         'Banheiros',            'bath',  '#06B6D4', 150),
  ('churrasqueiras',    'Churrasqueiras',       'grill', '#EA580C', 180),
  ('gas',               'Instalações a gás',    'gas',   '#F59E0B', 140),
  ('faz_tudo',          'Faz Tudo',             'tools', '#16A34A', 90),
  ('marido_aluguel',    'Marido de Aluguel',    'hammer','#65A30D', 90),
  ('seguranca',         'Segurança',            'cctv',  '#1F2937', 150),
  ('redes_logica',      'Redes e Lógica',       'net',   '#2563EB', 130),
  ('automacao',         'Automação',            'cpu',   '#7C3AED', 160),
  ('pequenos_reparos',  'Pequenos Reparos',     'fix',   '#0D9488', 80)
on conflict (slug) do nothing;

-- Regras de preço para todas as categorias sem regra
insert into public.pricing_rules (category_id, base_min, base_max)
select id, round(base_price * 0.85), round(base_price * 1.4)
from public.service_categories
on conflict (category_id) do nothing;

-- Avaliação escrita (comentário obrigatório na conclusão)
alter table public.service_requests
  add column if not exists review text;
