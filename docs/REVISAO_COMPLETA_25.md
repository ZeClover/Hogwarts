# Hogwarts 1890 — revisão completa das 25 decisões

A revisão abrange as 25 áreas do briefing. A limitação anterior a NPC/Profeta foi removida por instrução expressa do usuário. Implementação na branch `feat/revisao-completa-25-fluxos`, a partir de `83f404c27c5d9ad2cd97775f7419d478e7dcf63b` (`feat/v6-4-revisao-completa`). A `main` consultada antes da integração continha somente a inicialização. O merge das 25 revisões foi autorizado posteriormente pelo usuário. A stack foi preservada; deploy não faz parte desta integração.

## Matriz de entrega

| # | Área | Resultado e evidência |
| --- | --- | --- |
| 01 | NPCs | Nome, descrição e foto na criação curta, retrato reutilizável, segredos e revelações separados. Prévia e confirmação dos destinatários preservadas. `npcs`, `npc-publication`, `simplicidade` em integração/navegador. |
| 02 | Missões | Missão de grupo ou individual no mesmo criador; um destinatário é permitido; ano técnico não é obrigatório nem exposto. Pistas, objetivos, pré-requisitos, publicação e histórico preservados. Conclusão gera selo no Diário. |
| 03 | Itens | Efeitos em texto livre público; efeitos estruturados antigos continuam em Avançado, privados. Valores internos não se tornam preços públicos. Texto livre acompanha cópia, compra e entrega do item. |
| 04 | Lojas | Catálogo dentro da loja, busca de item existente, nome/imagem/descrição herdados. Preço e estoque privados; estoque vazio é ilimitado. Pedido sem preço público; negociação sem débito; aprovação atualiza saldo, estoque, recibo e posse na mesma transação. |
| 05 | Lugares e mapas | Nome, descrição, imagens e permissões mantidos. Marcador por toque/arraste ou teclado; coordenadas são bindings internos, sem formulário numérico visível. Regiões fechadas e locais secretos continuam controlados no servidor. |
| 06 | Aulas/Biblioteca | Autor livre ou NPC, matéria e ano escolar do aluno 1–7. Ano técnico oculto. Blocos de texto/imagem com ALT, até 50, reordenação, duplicação e remoção; liberação individual mantida. |
| 07 | Calendário | Menus, atalhos, oficinas e controles de Calendário/Eventos/Grades retirados da interface. URLs antigas exibem aviso de preservação; dados e APIs continuam disponíveis. Eventos não reaparecem como calendário disfarçado nas novidades. |
| 08 | Avisos | Título, texto e quadro existente no mesmo formulário; imagem opcional; publicação direta ou rascunho. Quadro e conteúdo continuam respeitando audiência e contexto. Propostas e moderação preservadas. |
| 09 | Correio | Destinatários e carta livre no mesmo fluxo; enviar salva a versão e coloca na fila do Mestre, sem entrega automática. Assunto, assinatura, remetente, modelo, imagem, prévia e histórico secundários. Ano letivo deixou de ser obrigatório. |
| 10 | Profeta | Manchete + notícia → publicar ou salvar em privado. Imagem opcional com ALT. Numeração automática transacional, respeitando número manual. Autoria, outros artigos, modelos, datas narrativas e histórico preservados. |
| 11 | Coleções | Cinco coleções com nome, descrição, imagem opcional e alunos que descobriram; revelação direta e individual. Temporada e vínculo com livro não bloqueiam um registro simples. Bestiário ainda exige declarar que os selecionados observaram o encontro; relato detalhado é opcional. |
| 12 | Investigações | Caderno compartilhado, participantes, autor identificado, edição própria, moderação, ocultação/restauração, arquivo e notas privadas preservados; testes existentes executados. |
| 13 | Taça | Quatro brasões, placares e ampulhetas. Pontos por Casa com confirmação direta; motivo e referências opcionais. Ciclos novos independem do calendário; períodos/resultados antigos, reabertura e escolha manual da vencedora preservados. |
| 14 | Histórias pessoais | Oficina independente retirada. Migração aditiva copia histórias existentes para missões individuais e entradas para pistas, preservando revelações, notas, histórico e fontes originais. A elegibilidade continua restrita ao protagonista original e às políticas herdadas; revogações legadas também se refletem na missão. |
| 15 | Sapos | Entrega, abertura com um clique, raridades, álbum, cópias físicas, trocas validadas, retirada de lacrados, origem, pools e probabilidades preservados. Configuração de conjuntos fica em Avançado dentro dos pacotes. |
| 16 | Recompensas/Selos | Entrega direta ao participante, tipo e referência/título quando necessário. Narrativa, item, dinheiro, coleção e recordação mantidos. Plano e histórico opcionais; duplicidade bloqueada. Selos derivam dos desfechos, sem exigir PDF. Documentos antigos continuam em área secundária. |
| 17 | Carteiras | Aluno + `+5 Galeões` + confirmar; crédito direto, débito com revisão explícita. Sicles e Nuques também aceitos. Motivo e descrição opcionais; saldo negativo e repetição bloqueados. Compras e prêmios usam o mesmo livro financeiro. |
| 18 | Modelos | Oficina independente removida da navegação; seletores e acesso à criação/reutilização ficam nos editores. Modelos de carta, jornal e demais famílias, aparência, assinatura, prévia e publicação preservados. |
| 19 | Anuários/Retrospectivas | Integrados ao Acervo/Diário e às criações, sem oficinas na lista principal. Anuário público, retrospectiva individual, capas/ALT e até 50 blocos preservados. Anuário pode usar resultado de ciclo independente da Taça. |
| 20 | Segurança/Backups | Central → Segurança e Backups. Exportação editável, importação revisada, ignorar/copiar duplicados, backup cifrado e confirmação de recuperação preservados. Cópia anterior automática. Backups antigos são migrados numa cópia descartável e validados antes de aplicar. CLI de backup abre o banco em modo somente leitura e não aplica migrations antes de copiá-lo. |
| 21 | Alunos/Convites | Novo aluno pelo site: nome, Casa e ano escolar; foto/biografia depois. Convites individuais de jogador ou Mestre, vínculo, validade, revogação e suspensão preservados. Criar aluno não cria conta nem senha. |
| 22 | Grupos | Criação, edição de nome/membros e uso nas políticas preservados na Central. Casas, anos, turmas e exclusões ficam nas restrições avançadas. Participar de grupo não concede papel de Mestre. |
| 23 | Mídia | Upload e biblioteca dentro dos criadores; gestão/reuso mantidos. Busca de opções, ALT e imagens privadas; corte visual por arraste e teclado. Metadados, créditos, apresentação, publicação, arquivo/restauração, histórico e aviso de original já público preservados. |
| 24 | Navegação | Jogador: Início, Explorar, Diário, Acervos, Correio. Central prioriza ações imediatas; administração fica recolhida. Busca universal de criações; módulos retirados não poluem a busca padrão. Auditoria técnica somente em Segurança/Avançado. |
| 25 | Revisão | Navegação retirada sem apagar backend, blocos e contextos preservados, responsividade e acessibilidade auditadas, compras/posses/selos e políticas verificadas. Capturas antes/depois e testes de regressão registrados abaixo. |

## Visual

A identidade existente foi mantida: brasões, ilustrações, fundo escuro, dourados, bordas e tipografia. Não houve substituição por dashboard de outra stack.

O baseline completo foi capturado de uma exportação de leitura do commit-base, sem worktree e sem dados da campanha. São 23 telas em desktop (1440 × 1000) e celular (390 × 844), antes/depois: Central, oficinas, missões, NPC, item, loja, lugar, livro, aula, aviso, correio, jornal, descoberta, investigação, Taça, Sapos, carteira, anuário, retrospectiva, segurança, Diário, Hogwarts e Acervos. A primeira etapa também mantém suas capturas originais de NPC e Profeta.

| Comparação | Desktop | Celular |
| --- | --- | --- |
| Central | [Antes/depois](screenshots/revisao-completa/central-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/central-mobile-comparacao.webp) |
| Carteiras | [Antes/depois](screenshots/revisao-completa/carteiras-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/carteiras-mobile-comparacao.webp) |
| Correio | [Antes/depois](screenshots/revisao-completa/correio-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/correio-mobile-comparacao.webp) |
| Taça | [Antes/depois](screenshots/revisao-completa/taca-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/taca-mobile-comparacao.webp) |
| Descoberta | [Antes/depois](screenshots/revisao-completa/descoberta-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/descoberta-mobile-comparacao.webp) |
| Diário | [Antes/depois](screenshots/revisao-completa/diario-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/diario-mobile-comparacao.webp) |
| Hogwarts | [Antes/depois](screenshots/revisao-completa/hogwarts-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/hogwarts-mobile-comparacao.webp) |
| Oficinas | [Antes/depois](screenshots/revisao-completa/oficinas-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/oficinas-mobile-comparacao.webp) |
| Segurança | [Antes/depois](screenshots/revisao-completa/seguranca-desktop-comparacao.webp) | [Antes/depois](screenshots/revisao-completa/seguranca-mobile-comparacao.webp) |

[Selo no Diário em celular](screenshots/revisao-completa/after/selo-mobile.png). As capturas são de fixtures identificadas como teste; não inventam acontecimentos na campanha.

A revisão visual conferiu hierarquia, texto, identidade, divulgação progressiva e controles no celular. O baseline já tinha barra inferior fixa em celular, cards escuros e arte provisória em Hogsmeade. A barra aparece no meio das capturas de página inteira por estar fixa no viewport; os testes verificam que os controles são alcançáveis ao rolar. A preferência estética do Mestre não é substituída por uma aprovação automática.

## Dados e recuperação

Antes da migração, o servidor de desenvolvimento foi parado e foi feita cópia offline em `/workspace/hogwarts-preservation/pre-revisao-completa-offline`. `PRAGMA integrity_check` retornou `ok`, com as 20 migrations anteriores. A instância atual migrou para 21 e continua íntegra.

A migration `021_simplified_portal.sql` é aditiva. Mantém as tabelas de histórias e documentos antigos; adiciona vínculos de migração, posses de itens, negociação e ciclos da Taça. O controle de migrations evita reaplicação. SQL de bootstrap local/nuvem foi regenerado com os mesmos seeds confirmados.

Posse nova é gravada junto da compra ou concessão, com chave única de origem. **Comprovantes antigos não foram convertidos em posse por inferência.** O inventário do portal registra entregas que ele executou; mecânicas externas do Hub continuam fora do escopo.

O teste de recuperação constrói um banco anterior à migration 021, com história, entrada, segredo e revelação. Cria backup operacional sem migrar a origem, migra a cópia, restaura pelo fluxo cifrado revisado e verifica leitura do protagonista, negativa aos demais e revogação. Nenhum SQL fornecido pelo backup é executado: só migrations conhecidas do aplicativo, em cópia temporária, com verificação de estrutura e referências.

Não havia banco real de campanha nem credenciais de produção neste checkout. Isso limita a validação ao banco de desenvolvimento e às fixtures, sem alegar que uma instalação externa já foi migrada.

Para rollback operacional: parar somente a instância afetada, preservar uma cópia do estado atual (incluindo dados posteriores ao backup), restaurar banco/mídia/chave do mesmo conjunto em **outro** `DATA_DIR` e validar a versão anterior isoladamente antes de trocar o serviço. Não apagar o diretório atual nem reduzir schema em produção como atalho.

## Verificação

Os resultados finais estão em `VALIDACAO_REVISAO_COMPLETA.md`. Foram verificados build/TypeScript/assets, lint, integração SQLite e libSQL, autorização por personagem/grupo, acessibilidade com axe, teclado, imagens, privacidade, backups, migração, estoque, dinheiro, idempotência, cartas e selos. Os testes antigos foram adaptados aos caminhos e seções novos, mantendo as verificações funcionais.

Reprodução:

```sh
cd /workspace/Hogwarts
npm ci
npm run build
npm run lint
npm test
npm run test:cloud
npx playwright test --workers=3
node scripts/capture-brief-completo.mjs after
```

Neste ambiente há 5 CPUs e memória suficiente para três workers de navegador. Cada fixture usa banco, porta e contas temporários próprios. Execuções Playwright simultâneas precisam de `--output` distinto para não disputar artefatos. Turso/Blob reais não foram usados: a suíte libSQL usa arquivo local.

## Arquivos e ambiente

Principais alterações: `public/simplicity.js`, `quick-create.js`, editores e navegação em `public/`; APIs em `src/server.ts`, `campaign.ts`, `commerce.ts`, `documents.ts`, `items.ts`, `content.ts`, `cup.ts`, `cup-cycles.ts`, `possessions.ts`, `import-validation.ts`, `archives.ts` e `cli.ts`; schemas de conteúdos; migration 021; bootstrap SQL; testes e capturas.

Instalação e inicialização reutilizáveis foram salvas no rascunho do ambiente. A publicação do ambiente é uma ação separada nas configurações do produto e não foi executada. Restauração numa nova tarefa não foi testada. A integração desta branch à `main` foi solicitada pelo usuário após a validação; deploy não faz parte do merge.
