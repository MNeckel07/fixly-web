-- ============================================================
--  Provas da 0037 — MÁSCARA DE CONTATO
--
--  Roda dentro da transação do `dry-run-migration.mjs`:
--
--    node --env-file=.env.local scripts/dry-run-migration.mjs \
--      0037_mascara_contato_e_categoria_frete.sql \
--      scripts/checks/0037_mascara_contato.sql
--
--  Estas provas NÃO precisam de sessão nem de linha em tabela nenhuma:
--  `mask_contact_info` é uma função pura. Dá para conferir chamando direto.
--
--  ⚠️ Metade dos casos é NEGATIVA de propósito. Uma máscara que esconde tudo
--  passa em qualquer teste positivo e quebra o produto: preço, data, hora e
--  medida são exatamente o que as pessoas escrevem no chat de um serviço. Se
--  um dia alguém "melhorar" a regra, é a segunda metade que vai avisar.
-- ============================================================

create temp table _res (
  ordem int, teste text, esperado text, obtido text, ok boolean
) on commit drop;

do $$
declare
  v_i     int := 0;
  v_saida text;
  v_casos jsonb := jsonb_build_array(
    -- texto,                                    deve esconder?, nome
    jsonb_build_array('9 9 5 4 0 0 1 9 5',        'sim', 'o furo do Fixly 12: digito com espaco'),
    jsonb_build_array('meu zap 9 9 5 4 0 0 1 9 5 liga la', 'sim', 'no meio da frase'),
    jsonb_build_array('9.9.5.4.0.0.1.9.5',        'sim', 'separado por ponto'),
    jsonb_build_array('9_9_5_4_0_0_1_9_5',        'sim', 'separado por underline'),
    jsonb_build_array('99540-0195',               'sim', 'celular SEM DDD (furo antigo)'),
    jsonb_build_array('99540 0195',               'sim', 'sem DDD, com espaco'),
    jsonb_build_array('(41) 99540-0195',          'sim', 'formatado com DDD'),
    jsonb_build_array('41995400195',              'sim', 'tudo junto'),
    jsonb_build_array('fala comigo no joao@teste.com', 'sim', 'e-mail'),
    -- daqui para baixo NADA pode ser escondido
    jsonb_build_array('fica R$ 1.250,00 no total', 'nao', 'preco comum'),
    jsonb_build_array('R$ 25.000,00 a obra toda',  'nao', 'preco grande'),
    jsonb_build_array('orcamento de R$ 100.000,00','nao', 'preco muito grande'),
    jsonb_build_array('R$ 200,00 + R$ 50,00 de deslocamento', 'nao', 'dois precos na frase'),
    jsonb_build_array('chego 14:30 do dia 05/09/2026', 'nao', 'hora e data'),
    jsonb_build_array('sao 3 comodos e 2 banheiros',   'nao', 'quantidades'),
    jsonb_build_array('medi 1 2 3 metros',             'nao', 'poucos digitos soltos'),
    jsonb_build_array('area de 120 m2, pe direito 2,80', 'nao', 'medidas')
  );
  v_caso jsonb;
begin
  foreach v_caso in array (select array_agg(x) from jsonb_array_elements(v_casos) x)
  loop
    v_i := v_i + 1;
    v_saida := public.mask_contact_info(v_caso->>0);

    insert into _res values (
      v_i,
      v_caso->>2,
      case when v_caso->>1 = 'sim' then 'esconde' else 'mantem' end,
      case when v_saida like '%[contato oculto]%' then 'escondeu' else 'manteve' end,
      (v_saida like '%[contato oculto]%') = (v_caso->>1 = 'sim')
    );
  end loop;

  -- a frase tem que continuar legivel: o separador depois do numero fica
  v_i := v_i + 1;
  v_saida := public.mask_contact_info('meu zap 9 9 5 4 0 0 1 9 5 liga la');
  insert into _res values (
    v_i,
    'o espaco depois do numero nao e engolido',
    'meu zap [contato oculto] liga la',
    v_saida,
    v_saida = 'meu zap [contato oculto] liga la'
  );
end $$;

select ordem, teste, esperado, obtido, case when ok then 'OK' else 'FALHOU' end as status
  from _res order by ordem;

select count(*) filter (where not ok) as falhas, count(*) as total from _res;
