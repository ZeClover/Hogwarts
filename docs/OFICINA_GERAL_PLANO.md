# Oficina Geral do Mestre — análise e plano de evolução

Status atualizado nesta branch: **F2.0a, F2.0b e F2.1 autorizadas e implementadas**, com [entrega de mídia](F2_0A_ENTREGA.md), [entrega de NPCs](F2_0B_ENTREGA.md) e [entrega de itens](F2_1_ENTREGA.md). Demais oficinas/fases permanecem planejadas. As PRs #1/F0/F1, #2/F2.0a e #3/F2.0b e a branch documental original permanecem preservadas; esta branch acrescenta somente a fase de Itens.

## Fontes e limite da análise

Foram comparados o código F0/F1 em `25db4a80e1ced6e904f9072dee72d81904998672`, a migração inicial, as APIs reais, os testes, os anexos V4 e o arquivo **`Hogwarts_1890_Prompt_Unico_Codex_Oficina_Geral.txt`**, lido integralmente (399 linhas), incluindo sua especificação incorporada, versão 1.0 de 21/10/2026.

O prompt único substitui a necessidade do arquivo separado anteriormente citado. **Não há especificação faltante.** O plano original exigia autorização antes de implementar. O usuário autorizou separadamente F2.0a, depois F2.0b e agora F2.1 nesta sessão; fundação/PR/Hub/V4 seguem preservados e as etapas posteriores continuam exigindo nova autorização.
A regra principal passa a ser: uma seção de conteúdo só está completa quando o Mestre consegue criar, editar, publicar/revelar e arquivar seu conteúdo no site, com persistência, destinatários, proteção de campos e fluxo verificado até o jogador. Uma tela de consulta ou uma tabela vazia não satisfaz isso.

## Matriz: editor existente / ausente / dependências / fase — baseline F0/F1

Esta matriz registra o inventário da F0/F1 no commit de referência. Os avanços posteriores estão detalhados nas entregas [F2.0a](F2_0A_ENTREGA.md), [F2.0b](F2_0B_ENTREGA.md) e [F2.1](F2_1_ENTREGA.md). “Existente” significa uma operação implementada e persistida pelo servidor. “Parcial” nunca equivale a oficina completa. As fases abaixo subdividem F2–F5 para revisão em PRs pequenos; não mudam a F0/F1 entregue.

| Oficina | Editor existente hoje | Editor ausente / lacuna | Dependências | Fase proposta |
| --- | --- | --- | --- | --- |
| OF-01. Side-Quests e Histórias Individuais | Nenhum; `/portal/missoes` é estado vazio | Definições, participantes, objetivos manuais, pistas, segredos, liberação, execução, resultados, certificados/PDFs e confirmação de recompensas | Núcleo editorial, NPCs, locais, mídia/templates, itens; carteira para recompensa monetária | F2.2a–c; recompensa monetária depende de F2.4 |
| OF-02. Itens | Nenhum | Cadastro independente de loja, campos simples/avançados, efeitos, materiais, estimativa privada, preço escolhido e segredos | Núcleo editorial, mídia, NPCs opcionais | F2.1 |
| OF-03. Lojas / Regiões / Ofertas | **Parcial:** abrir/fechar regiões, destinatários/grupos, visibilidade de locais e X/Y; criar contêiner secreto | Editor completo de loja, NPC, conteúdo público/privado, associação de itens, ofertas, disponibilidade, estoque e preço específico da loja | Núcleo, NPCs e itens; transações para compras | F2.3; operações financeiras em F2.4 |
| OF-04. NPCs | Nenhum | Registro reutilizável, campos públicos e privados, vínculos e liberação | Núcleo editorial e mídia | F2.0b |
| OF-05. Livros e Aulas | Nenhum; biblioteca é contêiner autorizado vazio | Editor de livros/páginas e aulas por matéria/dificuldade, vínculos com NPC professor, publicação e acesso | Núcleo, NPCs, mídia/templates, calendário quando houver grade | F3.0 |
| OF-06. Cinco Coleções | Nenhum; página genérica sem títulos/contagens revelados | Cinco editores, estágios de informação, destinatários, concessão separada, encontros presenciais e pacotes/sorteio | Núcleo, itens, livros, mídia, liberação granular | F4.0a–b |
| OF-07. Correio Bruxo | Nenhum; caixa vazia sem envio | Modelos, composição, rascunhos pessoais, envio, fila manual e entrega, jogador/NPC e leitura administrativa apenas de enviados | Núcleo, NPCs, mídia/templates; identidade real além do Viewer | F4.1 |
| OF-08. Quadros de Avisos | Nenhum; estado vazio | Murais por local/Casa, propostas de alunos, aprovação e publicação manual | Núcleo, permissões de local/Casa; missões para vínculos opcionais | F3.2 |
| OF-09. Calendário / Grade | Nenhum; estado vazio | Data diegética manual, ano, eventos, matérias, professores, salas e horários | Núcleo, NPCs e locais; catálogo de aulas | F3.1 |
| OF-10. Profeta Diário | Nenhum; estado vazio; imagens demonstrativas excluídas | Edições, matérias, imagens e templates; publicar para todos os jogadores | Núcleo, mídia/templates; calendário para data diegética | F4.2 |
| OF-11. Taça das Casas | Apenas brasões; nenhum editor ou total fictício | Pontos manuais, razões privadas, histórico, totais e ranking | Casas e auditoria; núcleo para administração | F3.3 |
| OF-12. Anuários | Nenhum | Anuário anual público do portal e retrospectivas por personagem, seleção editorial e publicação | Núcleo, mídia/templates, calendário e conteúdo previamente autorizado | F5.0 |
| OF-13. Mídia e Templates | **Parcial:** upload privado e moderado de foto de perfil, JPG/PNG/WebP, regravação/limites | Biblioteca de mídia do Mestre, vínculos/visibilidade, templates versionados de livro/carta/jornal/certificado/coleção e PDFs privados | Evolução incremental de `media`; renderizador de PDF quando necessário | F2.0a; certificados F2.2c; templates por módulo; gestão ampliada F5.2 |
| OF-14. Personagens e Permissões | **Existente F0/F1:** convites, perfil/bio/foto, Casa/ano, grupos, regiões/locais, suspensão e preview | Ampliar regras aos novos tipos/campos; Casa/turma/ano, exceções individuais, lotes, prévias, buscas privadas e privacidade dos rascunhos | Reutilizar sessões, `access_grants`, grupos, auditoria e DTOs atuais | F0/F1 pronta; evolução em cada fase |
| OF-15. Caderno de Investigação | Nenhum; estado vazio | Casos/notas coletivas dos jogadores, edição, vínculos autorizados, moderação, histórico e arquivo | Núcleo, permissões de grupo e referências previamente reveladas | F5.1 |

Não existe hoje um editor genérico de publicações. `publications` é uma estrutura preparada; `GET /api/publications/:id` e o filtro de novidades não substituem autoria administrativa. `audit_log` registra ações, mas ainda não mantém versões editoriais completas. Os catálogos não possuem produtos nem tabelas de ofertas/estoque.

## Arquitetura da administração

O acesso administrativo será organizado em dois destinos, sem misturar comandos rápidos com autoria extensa:

| Área | Finalidade | Evolução da rota |
| --- | --- | --- |
| Central da Sessão | Abrir/fechar regiões, escolher personagem para prévia e, futuramente, revelar conteúdo, iniciar missão, atualizar objetivo e liberar entrega por comandos explícitos | Preservar `/portal/mestre`; reorganizar gradualmente o painel atual |
| Administração → Oficina Geral do Mestre | Criar e manter o conteúdo reutilizável da campanha; oficinas por categoria | Planejar `/portal/mestre/oficinas` e suas categorias; não inserir links funcionais antes das respectivas entregas |

A Oficina Geral terá busca e filtros por categoria/status/destinatário, com resultados já autorizados pelo servidor. Cada editor oferecerá formulário rápido e seção avançada recolhida, salvar rascunho, duplicar como novo rascunho, comparar prévia do Mestre/jogador, publicar, administrar destinatários, revelar quando pertinente, arquivar e consultar alterações. Os controles devem comunicar claramente a consequência de cada ação.

A Central da Sessão poderá chamar **os mesmos serviços de domínio e políticas** usados pelas oficinas. Não será um segundo caminho com permissão mais fraca. As telas dos jogadores continuam com o perfil, Casa, brasões, cores, fotografias e navegação V4; detalhes de desenvolvimento e campos privados não aparecem nelas.

## Contratos e entidades — criados somente quando necessários

A camada atual `src/auth.ts` continua responsável pelo ator autenticado. `src/access.ts` será evoluída com políticas específicas; não deve se tornar um bypass universal de MASTER sobre toda informação futura. Os handlers de `src/server.ts` poderão ser separados por módulo à medida que crescerem, preservando APIs/testes da fundação.

| Contrato / domínio | Dados a introduzir na fase correspondente | Invariantes |
| --- | --- | --- |
| Autoria e versões | Revisões de conteúdo, autor/editor, status, versão publicada e eventos de alteração; escolher tabelas por domínio com validação tipada | Editar rascunho não muda a versão que jogadores já consultam; versão esperada evita sobrescrita concorrente |
| Destinatários e revelação | Política por recurso/seção/campo/etapa e concessões por personagem/grupo | Resposta pública montada por whitelist; sem segredos, preços, contagens, nomes ou anexos ocultos |
| NPCs | Identidade reutilizável, resumo público, notas privadas, referências a mídia | Um cadastro vinculado a vários módulos; NPC não responde automaticamente |
| Itens e ofertas | Definição de item separada de loja; associação/oferta com preço e estoque próprios | Criar item não gera oferta, estoque, posse ou concessão; nenhum preço interno em DTO PLAYER |
| Missões | Missões/instâncias de grupo, participantes, objetivos, pistas/revelações e resultado; arcos pessoais separados com capítulos/eventos | Publicar/anunciar não ativa instância; estado/objetivos/resultados só mudam por comando do Mestre |
| Recompensas | Planejamento separado de concessão, destinatário, snapshot público e chave de idempotência | Concluir missão não concede nada; confirmar duas vezes produz uma única concessão |
| Certificados | Template/revisão, conteúdo personalizado por participante, snapshot, geração e arquivo privado | Apenas dados destinados ao titular; gerar/baixar não revela missão nem confirma recompensa |
| Mídia geral | Proprietário administrativo, finalidade, tipo, vínculo, versões e autorização por uso | Fotos atuais continuam protegidas; bytes, thumbnails, PDFs e metadados obedecem à mesma política |
| Livros/aulas | Livro, páginas ordenadas, professor/NPC, matéria, dificuldade e liberação | Descoberta de livro/raridade não altera posse no Hub |
| Coleções | Registros por categoria, estágios de informação e evento de descoberta/concessão; pacote/sorteio separado | Nada é revelado ao visitar uma página; sorteio roda uma vez no servidor ao consumir pacote válido |
| Correio | Rascunho do autor, mensagem enviada, destinatários, fila e liberação manual | Mestre lê enviados, não rascunhos; ausência de respostas automáticas de NPCs |
| Demais módulos | Avisos/propostas, calendário/grade, edições/matérias, lançamentos de pontos, anuários/retrospectivas, casos/notas | Cada esquema nasce junto ao editor, regras, fluxo jogador e testes que o utilizam |

Não criar todas essas tabelas agora. Cada PR deve conter apenas sua migração, editor útil, APIs autorizadas, leitura correspondente e testes. Usar colunas explícitas e dados estruturados validados para cada domínio; evitar um campo JSON livre universal sem contratos.

### Ajustes conhecidos na fundação, para quando o domínio entrar

- `media.owner_character_id` hoje é obrigatório porque a única mídia privada é retrato. A biblioteca do Mestre precisará de autoria administrativa e finalidade; não inventar um personagem para contornar esse modelo.
- `access_grants.resource_type` tem CHECK limitado a REGION/LOCATION/PUBLICATION/MEDIA. Estender com migração e validação de integridade quando cada novo recurso existir; não enviar tipo arbitrário do cliente para SQL/políticas.
- `publications` hoje tem título/corpo e uma política de destinatário. Ela não representa objetivos, segredos por etapa, páginas e concessões; esses dados pertencem aos respectivos domínios. As novidades podem apontar para a projeção pública autorizada.
- A auditoria existente não equivale a histórico versionado. Acrescentar revisões/diffs seguros com antes/depois protegido, autor e justificativa, e controle de concorrência antes de prometer restauração de conteúdo. Rascunhos de cartas não terão corpo/assunto/anexos copiados para auditoria visível a outro autor ou Mestre.
- Um cadastro secreto não deve entrar em listas de referências para jogadores, autocomplete, filtros, contagens, resultados vazios diferenciados ou exportações. Logs administrativos podem conter identificadores, mas não vazar conteúdo privado para logs gerais.

### Operações distintas

| Operação | Resultado | Nunca deve fazer implicitamente |
| --- | --- | --- |
| Salvar rascunho | Persiste autoria privada | Publicar, notificar, revelar ou conceder |
| Publicar | Torna a revisão publicada elegível à política de acesso | Iniciar missão, abrir região, entregar carta ou conceder item |
| Selecionar destinatários | Define quem pode receber/consultar a projeção permitida | Tornar todos os campos públicos ou transferir posse |
| Revelar | Libera uma seção/etapa já preparada para destinatários explícitos | Conceder recompensa, validar teoria ou avançar objetivo |
| Iniciar missão | Cria/ativa a instância para os participantes escolhidos | Considerar anúncio como aceite/início ou atribuir sucesso |
| Atualizar objetivo/resultado | Registra decisão manual do Mestre | Determinar resultado por cliques, local visitado ou relógio |
| Conceder recompensa | Confirma um plano explícito com proteção contra duplicidade | Conceder tudo ao concluir a missão ou editar inventário do Hub |
| Arquivar | Retira da operação ativa, preservando histórico e leitura legítima já adquirida; revogação excepcional exige ação específica | Destruir registros financeiros, descobertas, recompensas ou trilha de alterações |
| Visualizar como | Calcula uma leitura autorizada sem efeitos | Salvar leitura, abrir pacote, entregar carta, gerar PDF persistente ou iniciar missão |

As novidades devem refletir conteúdo efetivamente publicado/liberado e autorizado. Um rascunho salvo, mudança de preço ou item não associado a uma oferta não cria uma publicação. Eventos de notificação futuros devem ser deduplicados por revisão/ação/destinatário e criados na mesma transação da ação de origem, não por um GET.

## Oficina de Side-Quests — contrato de completude

**Missões em Grupo** e **Histórias Individuais** terão abas e ações próprias (`Nova missão` / `Nova história`), com componentes compartilhados onde isso for útil e seções distintas no Diário. Histórias são arcos contínuos do protagonista, com capítulos, eventos e revelações privadas; não são missões individuais disfarçadas nem exigem objetivo fechado, certificado ou recompensa. Uma história individual não expõe título, participantes, objetivos ou PDF para outro personagem.

| Etapa do Mestre | Formulário e persistência | Leitura/efeito para o jogador |
| --- | --- | --- |
| Preparar | Título, resumo público, sinopse privada, capa opcional, ano letivo, importância privada, NPC/local/ganchos vinculados, condições de liberação e recompensas apenas planejadas | Nada antes de publicação/liberação |
| Editar objetivos | Três ou mais objetivos reordenáveis, opcionais/etapas internas, versões pública/privada, responsável Mestre; estados oculto/revelado/em andamento/concluído/falhou/cancelado e restrições por participante | Somente objetivos e observações explicitamente revelados |
| Organizar pistas | Conteúdo, mídia autorizada, vínculo NPC/local/coleção, destinatários e estágio; ações Revelar agora / Atualizar discretamente | Sem indicadores do número ou nome das pistas ocultas |
| Publicar/anunciar | Revisão publicada e eventual vínculo em mural | Anúncio não cria instância, aceite ou progresso |
| Selecionar participantes e iniciar | Participantes/grupos autorizados, instância e estado inicial | Diário correto; grupo e individual separados; sem vínculo automático por visitar local |
| Conduzir | Atualizar andamento e objetivos, revelar pistas, ajustar destinatários e registrar alterações | Reflexo somente para participantes autorizados, após ação do Mestre |
| Finalizar | Resultado manual SUCCESS/PARTIAL_SUCCESS/FAILURE, relato público e notas privadas | Resultado autorizado; nenhuma recompensa concedida automaticamente |
| Personalizar certificado | Texto/layout/template escolhido e campos por participante; prévia usa somente dados permitidos | Prévia no painel não publica PDF nem revela segredos |
| Gerar e liberar PDF | Snapshot/revisão, geração registrada, mídia privada e destinatário individual | Download autenticado para titular/Mestre; outra pessoa ou preview inadequado recebe 404 |
| Confirmar recompensa | Mestre revisa beneficiário, conteúdo/valor e confirma cada concessão com chave idempotente | Comprovante apenas com dados revelados; conceder novamente não duplica |
| Arquivar | Preserva versões, resultado, certificados e concessões; define leitura retrospectiva | Histórico conforme política de acesso, sem perda silenciosa |

Objetivos podem ser compartilhados ou específicos de participante, mas não devem misturar estado privado com o andamento público do grupo. Remover participante ou revogar uma revelação precisa retirar imediatamente acesso futuro à API e aos anexos vinculados; o sistema não promete apagar cópias que alguém já baixou.

A concessão de item cria o registro/comprovante do portal. O inventário mecânico continua exclusivamente no Hub e é atualizado manualmente com dados públicos do comprovante. Recompensas monetárias só podem ser aplicadas quando existir a carteira transacional da F2.4; até lá ficam planejadas, sem saldo ou concessão financeira fictícia. A parte monetária não será anunciada como concluída antes dessa dependência.

Para PDFs, começar com templates estruturados e personalizáveis com texto, campos e imagens aprovadas, sem HTML/JavaScript arbitrário. O renderizador deve operar no servidor, sem buscar URLs externas arbitrárias. Introduzir a dependência e o armazenamento de PDFs na F2.2c, não neste complemento documental.

## Segurança que exige tratamento específico

**Rascunhos do Correio:** MASTER poderá ler mensagens enviadas, mas não os rascunhos de outra pessoa. Essa regra também vale ao usar Visualizar como Personagem. A autorização deve checar o **autor autenticado real**, além do personagem de leitura; não basta tratar o preview como se ele fosse o autor do rascunho. As permissões amplas atuais de mídia administrativa não devem ser reutilizadas indiscriminadamente para anexos de rascunhos. Após envio, a mensagem e os anexos seguem a política de enviados/fila/entrega; leitura não equivale a entrega.

**Coleções e pacotes:** verificar pacote válido/posse autorizada, consumir e sortear no mesmo comando transacional, com RNG do servidor e pesos definidos pelo Mestre. Repetir a requisição devolve o mesmo resultado; não sorteia novamente. Uma prévia nunca consome pacote ou dispara animação persistida. Animações de revelação são iniciadas pelo Mestre, com evento por destinatário, e respeitam redução de movimento.

**Pontos, preços e PDFs:** razões da Taça e preços internos só existem nas projeções administrativas. Somar pontos ou montar comprovantes não pode usar um objeto administrativo serializado e depois esconder campos na tela. PDF/thumbnail tem autorização própria e contexto herdado; metadados/listagem não confirmam um documento secreto.

**Estado e concorrência:** publicação, revelação, entrega, consumo de pacote e recompensa são comandos explícitos. Usar transações, versão esperada e idempotência por operação. Uma resposta de sucesso só ocorre após persistência; um erro não deixa estado intermediário. GETs e prévias permanecem puros.

## Sequência proposta de PRs

| Fase / entrega | Fluxo administrativo real | Dependência / conclusão |
| --- | --- | --- |
| F0/F1 — preservada | Fundação, perfis, convites, Casas, grupos, regiões/locais e prévia | PR #1 preservada; Oficina Geral foi acrescentada nas entregas F2.0a/F2.0b sem alterar essa branch original |
| F2.0a — Oficina Geral, mídia e contrato editorial | Entrada administrativa unificada, biblioteca de imagens aprovadas, upload, vínculo e versão; padrão de rascunho/publicação/destinatários testado em um recurso real | Entregue nesta branch para mídia; demais oficinas continuam pendentes |
| F2.0b — NPCs reutilizáveis | Criar/editar NPC, campos públicos/segredos, publicar/liberar/arquivar e consulta autorizada | Entregue: reusa F2.0a, vínculos nos locais atuais e revelação separada; sem respostas automáticas. Integrações nos futuros editores continuam pendentes |
| F2.1 — Itens | Editor rápido/avançado, segredos, estimativa/preço privados, duplicação e arquivo; sem associação automática | Entregue: cadastro e artigos autorizados, valores privados e efeitos ordenáveis; prepara recompensas e ofertas, sem criar comércio |
| F2.2a — Missões: autoria e participantes | Side-quest e história individual, publicação separada de início, participantes e dois Diários | NPCs, locais, núcleo; editor usável persistente, com arcos pessoais/capítulos separados |
| F2.2b — Missões: condução e resultado | Objetivos manuais, pistas por destinatário, condições verificadas pelo Mestre, andamento e três resultados | Não declarar Oficina de Missões completa sem este corte e o seguinte |
| F2.2c — Missões: certificados e concessão | Template, PDF privado individual e confirmação idempotente de recompensas; comprovantes públicos para cópia manual | Depende de mídia/templates/itens; parte monetária depende de F2.4 |
| F2.3 — Lojas e ofertas | Editor completo de loja/NPC/localização, associação manual de itens, estoque, preço privado por loja e disponibilidade | Reutiliza regiões/locais/markers atuais; não substituir a fundação |
| F2.4 — Operações financeiras | Pedido, aprovação manual, estoque, carteira em Nuques e recibo com transação atômica | Preços públicos continuam proibidos; 1G=493N, 1S=29N; sem integração automática com Hub |
| F3.0 — Livros e aulas | Editores de livro/página e aula por matéria/dificuldade; acervos normal/raridades | Descoberta e posse independentes; NPC professor opcional |
| F3.1 — Calendário e grade | Editar data diegética/ano, eventos, matérias, professor, sala e horários | Sem avanço automático nem presença |
| F3.2 — Murais | Editor por local/Casa, proposta de aluno, aprovação/publicação | Visibilidade depende do local; anunciar missão não a inicia |
| F3.3 — Taça | Lançamento manual/auditado, razão privada, total e ranking | Nenhum ponto automático por missão, página ou aula |
| F4.0a — Coleções e revelações | Cinco editores, campos progressivos, destinatários, registro de encontro presencial e animações por comando | Bestiário não descobre por navegação; raridade não implica posse |
| F4.0b — Sapos e pacotes | Raridades/pesos, pacote válido, abertura/sorteio transacional server-side | Sem sorteios no cliente ou repetição para buscar outro resultado |
| F4.1 — Correio | Templates, rascunhos próprios, enviados, fila e entrega manual | Mestre lê enviados, não rascunhos; nenhum NPC responde sozinho |
| F4.2 — Profeta Diário | Edição/matérias/imagens/template; prévia e publicação para todos os jogadores | “Todos” é o público autenticado do portal, não a internet |
| F5.0 — Anuários | Anuário anual e retrospectiva individual com edição/publicação próprias | Seleção manual; não agrega segredos de outros módulos automaticamente |
| F5.1 — Investigação | Casos e notas coletivas criados pelos jogadores, moderação e arquivo | Não confirma teorias nem importa segredos individuais |
| F5.2 — Mídia ampliada, importação e qualidade | Gestor de templates/ornamentos completo, exportação/importação com prévia de conflitos, backup/restauração e compatibilidade de versões | MASTER apenas; preservar IDs/histórico e arquivos privados; nunca mesclar bancos do Hub |

A sequência é proposta, não autorização de implementar todas as fases. A próxima fase de código deverá ser explicitamente escolhida. Para antecipar missões, manter F2.0 enxuta e limitar Itens ao cadastro necessário; não antecipar compras nem os módulos F3/F4.

## Critérios transversais de aceite

Toda oficina deverá passar por estes critérios e pelos específicos do [backlog](BACKLOG_OFICINAS.md):

1. **Editor real:** criar, editar, buscar/filtrar, duplicar como rascunho, prévia, publicação/revelação pertinente, destinatários, arquivo e histórico. Formular campos rápidos com avançados recolhidos. Duplicar não copia concessões, consumo de pacote, entregas nem participantes ativos inadvertidamente.
2. **Persistência:** recarregar navegador e reiniciar servidor preservam rascunho/publicado/arquivo e histórico. Migração e backup/restauração incluem vínculos e mídia. Salvamento concorrente retorna conflito em vez de perder alterações.
3. **Publicação:** salvar não publica; editar não muda revisão publicada antes de confirmar; arquivar segue política explícita. Publicar não concede, entrega, inicia, descobre ou avança tempo.
4. **Destinatários e segredos:** jogador autorizado recebe projeção permitida; outro jogador não recebe título, trecho, contador, ID, filtro, PDF ou imagem. Testar API direta/URL forçada, busca, listagem e anexos; negar 403/404 de forma consistente.
5. **MASTER e preview:** só papéis autorizados alteram o domínio. Prévia não escreve auditoria de ação do personagem, leitura, progressão ou entrega; não contorna privacidade pessoal de rascunhos. CSRF, origem e sessão continuam obrigatórios.
6. **Transações/idempotência:** repetir concessão, entrega ou abertura retorna resultado estável, sem duplicar recompensa, item, mídia final ou consumo. Falhas revertem integralmente.
7. **Ponta a ponta:** Mestre cria conteúdo → salva e recarrega → publica para A → A vê o conteúdo correto → B não vê nada privado → Mestre revela/arquiva → ambos têm o comportamento esperado após refresh.
8. **390 px, desktop e acessibilidade:** formulário utilizável, avançados recolhíveis por teclado, validação/foco claros, sem overflow, contraste e redução de movimento. Revalidar quatro Casas e assets quando houver mudança visual.
9. **Conteúdo:** seed sem campanhas/produtos/estoques/eventos falsos; 1890–1891 como ano inicial, com anos seguintes criados somente pelo Mestre quando houver suporte; elegibilidade histórica por período. Data técnica de auditoria não vira automaticamente data diegética. Nenhuma geração de imagem por IA.
10. **Entrega:** PR pequeno com migração necessária, resumo de rotas/entidades, testes e capturas; não considerar concluído apenas porque há uma rota do jogador.

## Decisões e autorização

A especificação já resolve estes pontos: rascunho do Correio é do autor; anúncio não inicia missão; Histórias Individuais são arcos próprios; certificados também cabem em fracasso/sucesso parcial; descoberta não significa posse; arquivamento não destrói a jornada; anos seguintes são configurados manualmente; Profeta publicado é global no portal.

Decisões de implementação a resolver somente na fase correspondente: tratamento de novos participantes sem revelar capítulos retroativamente; layout/campos editáveis de cada template; revogação controlada de um PDF já emitido; origem do pacote e regras de duplicatas; confirmar se venda direta do Mestre integra a F2.4. Nenhuma depende de escrever previamente conteúdo, números de missões, estoques ou cartas reais.

**Próximo código: aguardar autorização do usuário para F2.2a (Missões e Histórias Individuais).** A F2.0a, F2.0b e F2.1 foram entregues; seguem os três cortes de Missões, com Lojas na mesma F2. Os cortes menores não dispensam o aceite integral do módulo. Nenhuma fase será iniciada automaticamente ao concluir este plano.

## Complementos da leitura integral — requisitos vinculantes

### Público e exceções

O estado atual combina ALL ou grants de personagem/grupo; **não implementa** escopo por Casa/turma/ano nem exclusão individual. A evolução da OF-14 deve distinguir destinatário, contexto obrigatório e exceção explícita. Proposta: negar prevalece sobre permitir; região/local fechado prevalece quando o módulo exige presença; só então avaliar publicação/liberação e os escopos de Casa/turma/ano/personagem/grupo. Toda alteração em lote deve registrar a seleção efetiva e suas exceções, evitando conceder por acidente a um personagem de grupo público.

“Preparado” significa pronto para uso do Mestre, ainda sem acesso do jogador. Publicar uma oferta exige item preparado, oferta publicada e loja/região autorizadas; nenhuma dessas operações concede o item. Profeta tem política própria: edição publicada para todos os jogadores autenticados, sem distribuição individual. Comprovantes, cartas entregues e jornada histórica não são apagados ao fechar uma região ou mudar de ano.

### Estados e comandos de domínio

| Domínio | Estados / comandos previstos |
| --- | --- |
| Missão | Rascunho → Preparada → Liberada → Em andamento → Encerrada → Arquivada; reabertura explícita/auditada |
| Objetivo | Oculto, Revelado, Em andamento, Concluído, Falhou, Cancelado; apenas Mestre e com ordem editável |
| História Individual | Arco de protagonista, capítulos/eventos/revelações; sem conversão automática para missão nem objetivo/certificado obrigatório |
| Carta | Rascunho → Enviada/Aguardando → Entregue, Retida, Devolvida ou Extraviada; entrega manual |
| Certificado | Rascunho → Autorizado → Disponível; emitir, liberar e conceder recompensa são operações diferentes |
| Edição do Profeta | Rascunho → Revisão → Publicada → Arquivada; publicação global no portal |
| Aviso | Rascunho → Aguardando aprovação → Publicado → Retirado; aprovação exclusiva do Mestre |

As novas rotas manterão o prefixo existente `/api/master/`, com endpoints de recurso e comandos explícitos (`prepare`, `publish`, `reveal`, `complete-objective`, `reopen`, `issue-certificate`, `award-reward`, `deliver-letter`, `approve-purchase`, `add-house-points`). O nome final pode ser ajustado sem alterar os comportamentos. Cada handler faz autorização/versão/idempotência antes de persistir; nunca aceita um `:type` arbitrário sem registro de tipos permitidos.

### Detalhes que não podem desaparecer dos editores

| Oficina | Campos / comportamentos obrigatórios além do resumo da matriz |
| --- | --- |
| OF-02 | Categoria, qualidade, materiais, propriedades, múltiplos efeitos, requisitos de uso, grau de magia, ativação, usos/cargas, frequência, complexidade de confecção, disponibilidade e raridade. Estimativa é referência privada; preço final continua decisão do Mestre. Campos avançados opcionais/recolhidos. |
| OF-03 | Cadastro real de regiões/locais e estabelecimentos, imagem e base do mapa, NPC comerciante, opção de possuir catálogo, condições/limites de ofertas, estoque quando aplicável e exceções por personagem. Marcador pode abrir diretamente catálogo, mural ou biblioteca. Sem comerciante chatbot, deslocamento mecânico ou roteiro de negociação. Recibo exibe só o preço pago e não mostra data visível. |
| OF-04 | Papel, localização, Casa/vínculo relevante, retrato opcional e fragmentos progressivos. Um NPC referenciado não se torna conhecido por essa referência: DTOs não expõem nome secreto por associação. |
| OF-05 | Livro: título/autor conhecido/matéria/sinopse/capa, capítulos e páginas rich text com imagens opcionais; acesso por obra/página, Seção Reservada, turma e personagem. Aula: Fundamentos/Prática/Aprofundamento, pré-requisitos informativos e exercícios opcionais, em ordem flexível. Sem empréstimos, devoluções, presenças ou aprendizado automático. Livros pessoais dos jogadores não são sobrescritos por edições oficiais. |
| OF-06 — Sapos | Retrato estático, biografia historicamente elegível, raridades Comum/Incomum/Rara/Lendária, temporada e pesos configurados; sortear raridade e depois chance igual entre cartas elegíveis daquela raridade. Validar pool publicado/não vazio. Duplicatas físicas e descoberta permanente são registros diferentes; trocar duplicata não apaga descoberta. Não selecionar manualmente o conteúdo de cada pacote. |
| OF-06 — Bestiário | Espécie, camadas públicas/secretas, imagem e indivíduos notáveis opcionais. Só encontro presenciado confirmado pelo Mestre gera descoberta; ler um livro não substitui o encontro. |
| OF-06 — Raridades | Referenciar o mesmo ID de livro da OF-05; páginas/trechos revelados, notas pessoais e apresentação da coleção, sem duplicar obra nem presumir posse física. |
| OF-06 — Recordações | Acontecimento, narrativa, imagens/selos/modelos e anotações do jogador. Evento coletivo produz entradas individuais somente para participantes escolhidos. Não é inventário nem mercadoria. |
| OF-06 — Curiosidades | Relíquia/objeto extraordinário, criação de jogador sujeita a aprovação, camadas, descobridores e teorias pessoais. Saber da peça não concede posse/uso. |
| OF-07 | Envelope/pergaminho/selo, assinatura, NPC remetente ou anonimato e imagens facultativas. Autores podem salvar rascunhos; enviar não entrega. Mestre lê enviados e escolhe entregar/reter/devolver/extraviar; NPC só responde por carta escrita pelo Mestre. Sem chat instantâneo. |
| OF-08 | Autor/remetente, categoria, decoração e data ficcional opcionais; vínculo local/Casa. Proposta do aluno não publica sem aprovação. |
| OF-09 | Anos 1890–1891 e seguintes por cadastro manual; grade por turma/ano/Casa com professor, sala, dia e horário, duplicação de horários e modelos recorrentes sem avanço automático da campanha. |
| OF-10 | Número/título/data fictícia, capa, manchete/subtítulos, blocos texto/imagem, autores e notas/anúncios. Template legível no celular; rumores não são validados como fatos e segredos não alimentam matérias automaticamente. |
| OF-11 | Quatro ampulhetas, lançamento positivo/negativo e motivo privado, personagem/evento opcional. Corrigir por lançamento auditado; registrar vencedor por ano, sem apagar histórico. Jogador recebe somente totais/ranking. |
| OF-12 | Capa, acontecimentos públicos selecionados, imagens/destaques e vencedor oficial; retrospectiva separada por dono com publicação em momentos distintos. Nada de texto automático sem revisão. Encerrar ano não apaga cartas/missões/coleções/carteira/investigações. |
| OF-13 | Nome descritivo, categoria, dimensões, alt, crédito/origem opcional, classificação pública/privada, capa e corte responsivo editável. Templates: livro, carta, periódico, certificado, criatura, colecionável, vitrine e scrapbook. Não exigir arte exclusiva por registro. |
| OF-15 | Jogadores criam casos e contribuições com autoria. Mestre observa, modera e registra avisos privados; não é o autor automático da investigação. Nenhuma validação de teoria ou publicação automática de descoberta individual. |

### Tempo real e fila confiável

A F0/F1 usa polling a cada cinco segundos; isso **não é** a fila de revelações exigida. Planejar um outbox persistente ao introduzir pistas/atualizações da F2.2, e reutilizá-lo para F4. Cada evento de apresentação possui ID distinto da descoberta/concessão, destinatários efetivos, versão e estado de entrega. Canal autenticado (SSE ou alternativa justificada) avisa o conectado; offline consulta a fila ao voltar. Replay visual não concede novamente nem muda o registro de descoberta. Animação/silêncio são escolhas do Mestre; redução de movimento é respeitada.

Uma prévia não confirma consumo do evento, leitura nem geração de documento. Reabrir uma página pode buscar eventos pendentes, mas não criar eventos ou inferir descobertas pela navegação.

### Importação, exportação e anos seguintes

O backup atual é CLI; não existe hoje importador/exportador de campanha no painel. A F5.2 deve acrescentar operações MASTER, validação de formato/versão/IDs/vínculos, simulação de conflitos e confirmação antes de gravar, com backup recuperável e transação quando aplicável. Importação não torna dados publicados por acidente. Nunca mesclar bancos do Hub; arquivos privados permanecem em armazenamento autorizado.

O CHECK atual de `publications.campaign_year` aceita apenas 1890 e 1891. Planejar evolução para `school_years` ao introduzir a necessidade real de anos letivos configuráveis; manter o ano inicial e migrar as relações sem perder histórico. Datas diegéticas e ano escolar são definidos pelo Mestre; o relógio técnico de auditoria não avança a campanha.

Migrações futuras devem prever validação de ida/retorno quando reversível; alterações destrutivas exigem caminho seguro por backup e restauração testada, sem prometer rollback automático inexistente na fundação.
