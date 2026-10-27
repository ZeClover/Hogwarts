# F4.2 — Profeta Diário

Editor real na Oficina `newspapers`: número, ano, data fictícia, manchete, subtítulo, autores, capa, artigos reordenáveis com NPC/imagem e notas. Usa o ciclo de rascunho, preparação, prévia, publicação, duplicação e arquivo com versões. A política global é forçada pelo servidor; não existe distribuição individual. Publicar enfileira novidade para os cinco personagens, sem produzir acontecimentos ou textos automaticamente.

Leitura em `/portal/profeta` e `/portal/conteudos/newspapers/:id`. Arquivo mantém edições publicadas. Imagens de artigos possuem rota protegida por edição/revisão; prévia de imagem do rascunho exige Mestre e personagem autorizado. Templates estruturais não aceitam HTML arbitrário.

Validação: teste novo de rascunho/globalidade/isolamento/revisões/arquivo aprovado, além da base de 146 testes da fase anterior. E2E cria edição e artigo pela interface e lê em celular, Axe sem violações e sem overflow. Capturas em `screenshots/f4-2/`.
