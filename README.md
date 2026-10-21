# Hogwarts 1890 — Arquivos Mágicos

Portal privado para a campanha de 1890–1891. Fundação **F0/F1** e **F2.0a–F2.2a — Oficina Geral, Mídia, NPCs, Itens e autoria narrativa**, independentes do Hub RPG. Preserva as fotografias, brasões, cores, salas comunais e organização do protótipo Visual V4 fornecido pelo Mestre.

## Oficina Geral — F2.0a

O Mestre já pode criar, editar, preparar, publicar, duplicar e arquivar registros na **Oficina Geral → Biblioteca de Mídia**, com upload/seleção V4, corte, metadados, notas privadas, destinatários, turmas, prévia e histórico. Jogadores consultam somente imagens liberadas em **Acervos → Galeria de Imagens**. Rascunhos e revisões publicadas são independentes.

[Entrega F2.0a: uso, rotas, migração, capturas, verificações e limites](docs/F2_0A_ENTREGA.md). A PR da fundação permanece preservada; esta fase tem sua própria branch/PR. As entregas seguintes de NPCs, Itens e autoria narrativa estão descritas abaixo; condução de missões e Lojas continuam planejadas.

## NPCs — F2.0b

Em **Oficina Geral → NPCs**, o Mestre cria perfis com retrato opcional, papel, Casa, vários locais, notas exclusivas e informações progressivas. Publicar libera o perfil conforme o público escolhido; cada informação exige revelação explícita aos personagens. Editar e republicar o texto de uma pista não substitui o conhecimento anterior sem nova revelação. O jogador consulta **Acervos → Pessoas conhecidas** e os contatos autorizados nos locais.

[Entrega F2.0b: uso, segurança, migração, testes e limites](docs/F2_0B_ENTREGA.md). NPCs são distintos dos cinco protagonistas, reutilizáveis pelo mesmo ID e não respondem automaticamente. A PR anterior de mídia permanece preservada.

## Itens — F2.1

Em **Oficina Geral → Itens**, o Mestre cadastra objetos com nome/descrição revelada, imagem opcional e corte, categoria, qualidade, materiais, propriedades, efeitos ordenáveis, requisitos, usos/cargas, fabricação e segredos. Estimativa e preço escolhido são privados e independentes, informados em Galeões/Sicles/Nuques e armazenados em Nuques inteiros. Publicar libera só o artigo autorizado em **Acervos → Artigos revelados**, com cópia da descrição pública; não cria oferta, posse, compra ou recompensa.

[Entrega F2.1: uso, rotas, migração, testes e limites](docs/F2_1_ENTREGA.md). As propriedades internas só são reveladas se o Mestre decidir incluí-las na descrição pública. Cada item mantém um ID reutilizável para as futuras ofertas e recompensas.

## Missões e Histórias — F2.2a

Em **Oficina Geral → Missões e Histórias**, o Mestre cria missões com resumo, capa opcional, NPC/local por ID, gancho e planejamento privado. Publicar prepara um anúncio em **Oportunidades**; liberar participantes adiciona a missão ao Diário como disponível; iniciar muda o andamento apenas dos selecionados. São comandos separados.

**Histórias Individuais** têm arcos, protagonista e entradas próprias (capítulos, eventos e revelações). Publicar e liberar o arco não revela suas entradas. Cada revelação é explícita e preserva o texto autorizado; arquivar mantém a leitura histórica de quem tem acesso. O Diário possui duas seções distintas e aplica todas as permissões no servidor.

[Entrega F2.2a: uso, rotas, segurança, migração, testes e limites](docs/F2_2A_ENTREGA.md). Este é o corte de autoria: objetivos, pistas de missão, desfechos, fila de revelações, certificados/PDFs e recompensas ainda pertencem às fases F2.2b/F2.2c. A Oficina de Missões integral ainda não está concluída.

## O que está pronto

- Login por convite pessoal, papéis MASTER/PLAYER e sessão autenticada no servidor.
- Cinco personagens confirmados, sem contas/senhas automáticas: Atlas Black e Darius Gaunt (Grifinória), Eiris Scamander (Lufa-Lufa), Vane Grimms (Sonserina), Drake Lovegood (Corvinal). Ano escolar começa indefinido até o Mestre configurar.
- Início, Hogwarts, Hogsmeade, Acervos, Correio e perfil; novidades começam vazias.
- Biografia e foto próprias; Mestre pode moderar. Nome, Casa e ano escolar são exclusivos do Mestre.
- Central do Mestre com convites, suspensão de jogadores, personagens, grupos, acesso a regiões e visibilidade de locais. Todas as alterações passam pelo servidor e geram auditoria.
- Hogsmeade fechada por padrão. Destinatários por personagem ou grupo. Lojas secretas exigem permissão específica, mesmo se a região estiver aberta a todos.
- Visualizar como personagem: leitura usando as permissões daquele personagem, sem trocar a sessão real e sem gravar leituras/revelações.
- Contêineres autorizados da biblioteca e lojas com estados vazios. Sem produtos, preços, saldos ou transações inventadas.

## Stack

**Node.js 24.x + TypeScript + SQLite nativo (`node:sqlite`) + HTML/CSS/JavaScript**. A única dependência de execução externa é `sharp`, para decodificar e regravar fotos. O servidor HTTP, migrações, autenticação e autorização estão no projeto. SQLite atende a um grupo pequeno em uma única instância com volume persistente; não é uma arquitetura para múltiplas réplicas sem coordenação. `node:sqlite` pode emitir aviso de API experimental no Node 24.

O repositório estava vazio, sem framework ou aplicação anterior. Nada foi conectado ao Hub RPG.

## Primeiro uso

Requisitos: Node **24.x**, npm e um volume local privado para `data/`.

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm run master:invite -- mestre@seu-dominio.com
npm run dev
```

Abra o link pessoal impresso pelo comando. Cadastre o e-mail informado e uma senha entre 12 e 128 caracteres. O convite inicial expira em **1 hora**, não cria senha padrão e só pode ser emitido enquanto não houver uma conta MASTER. Reemitir o convite inicial invalida o anterior.

Depois de entrar, crie os convites dos jogadores pela Central do Mestre. Cada jogador deve receber seu próprio link, vinculado ao e-mail e a um dos personagens. Os convites duram **72 horas**, são de uso único e podem ser revogados. O link é exibido somente na criação; não existe envio automático de e-mail ou Discord.

O token fica no fragmento do link (`#convite=`), fora dos logs HTTP e de cabeçalhos Referer. Compartilhe apenas com o destinatário. Abrir um convite já autenticado exige sair antes de ativar a nova conta.

Para executar a compilação:

```sh
npm run build
npm start
```

O endereço padrão é `http://127.0.0.1:3000`. `APP_ORIGIN` deve corresponder exatamente ao endereço usado no navegador, incluindo protocolo e porta. `localhost` e `127.0.0.1` são origens diferentes.

## Configurações

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NODE_ENV` | desenvolvimento | Em `production`, exige HTTPS em `APP_ORIGIN` |
| `HOST` | `127.0.0.1` | Interface de escuta; configure conforme o proxy privado |
| `PORT` | `3000` | Porta do servidor |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Origem permitida para alterações/convites |
| `DATA_DIR` | `./data` | Banco e mídias privadas em volume persistente |

Não há segredo de sessão compartilhado para configurar: tokens de alta entropia são individuais e o banco guarda seus hashes. Senhas usam scrypt com sal individual. Os cookies têm HttpOnly e SameSite=Strict; HTTPS também ativa Secure e o prefixo `__Host-`.

**Para uma instalação privada:** use uma única instância Node atrás de HTTPS, com `NODE_ENV=production`, `APP_ORIGIN=https://seu-host` e volume persistente privado em `DATA_DIR`. O proxy deve encaminhar `/api/*` ao Node sem cache e não deve servir `data/`, `backups/` ou o repositório. O app não confia em `X-Forwarded-For`; atrás de proxy, o limite de autenticação por IP é compartilhado entre clientes, além do limite individual por e-mail. Avalie o limite no proxy quando instalar.

Esta entrega não executa deploy público nem configura domínio, HTTPS, e-mail, serviço de sistema ou backup externo automaticamente.

## Usando a Central do Mestre

1. **Regiões:** marque aberta/fechada, escolha todos ou destinatários selecionados e salve. Personagens e grupos selecionados são combinados por união. Uma região fechada prevalece sobre qualquer permissão de local.
2. **Grupos:** crie/edite um nome e seus integrantes. Alterações afetam imediatamente a autorização no servidor.
3. **Locais:** habilite/oculte um local e controle seus destinatários. Marcar secreto obriga uma permissão específica de personagem/grupo, mesmo se o seletor estiver em “Todos”. Um local desativado permanece oculto. É possível preparar um local secreto com uma imagem existente; não há cadastro de produtos.
4. **Marcadores:** X/Y em percentuais, independentes da imagem. Campos vazios deixam o local apenas no diretório. As posições herdadas da V4 são ilustrativas.
5. **Personagens:** configure nome/Casa/ano e modere biografia/foto. Suspender uma conta de jogador revoga todas as suas sessões; reativar exige novo login.
6. **Visualizar como:** escolha o personagem na barra superior ou no perfil administrativo. A aparência muda sem recarregar. Voltar ao Mestre restaura o painel. A simulação não permite edições.
7. **Auditoria:** últimas 100 ações críticas, com horário real em America/Sao_Paulo. Datas técnicas ficam na administração; não viram narrativa da campanha.

A interface consulta o estado a cada 5 segundos quando a aba está visível; permissões são reavaliadas em **cada** requisição. Formulários em edição preservam seu conteúdo até salvar/recarregar.

## Fotos e conteúdo privado

Fotos: JPG/PNG/WebP, até 2 MiB e 16 milhões de pixels, sem animação. O servidor valida assinatura e tipo real, decodifica, remove metadados e regrava WebP de até 512×512. O nome original não é armazenado. Os arquivos ficam fora de `public/`, com leitura autenticada e autorização do proprietário/Mestre; futuras publicações/mídias possuem estrutura de permissões explícitas. A remoção revoga a URL atual e apaga seus bytes. Fotos antigas substituídas permanecem privadas no armazenamento até manutenção manual; não há rotina automática de limpeza nesta fase.

O servidor filtra os registros **antes** de gerar os DTOs para o navegador. Regiões fechadas não enviam nomes, IDs, marcadores ou imagens de seus locais. Coleções inéditas não enviam nomes/contagens. Apenas publicações `PUBLISHED` com destinatário e contexto autorizados podem aparecer em novidades. A tabela legada `publications` ainda não possui editor; mídia, NPCs e itens usam seus próprios domínios de publicação.

Arquivos visuais de ambientação em `public/assets/` são públicos por definição; não coloque material secreto ali. Os exemplos de jornal do protótipo foram excluídos do diretório publicado. Nada é descoberto por visitar uma página.

## Migrações e seed

`npm run db:migrate` aplica os arquivos de `migrations/` em ordem, com controle em `schema_migrations` e transação. O servidor também aplica migrações pendentes antes de escutar. Faça backup antes de atualizar; migrações não têm rollback automático.

O seed é idempotente: quatro Casas, cinco personagens confirmados, Hogwarts aberta, Hogsmeade fechada e os contêineres da biblioteca e quatro lojas do protótipo. Não redefine alterações já realizadas pelo Mestre. Não cria usuário, senha, publicação, NPC, item, saldo, missão ou recompensa.

## Backups e recuperação

Pare o servidor antes de gerar um snapshot, para manter banco e fotos consistentes entre si:

```sh
npm run backup
# Ou escolha um diretório privado:
npm run backup -- /caminho/privado/backup-1890
```

O comando usa a API de backup SQLite e copia `media/`. O resultado contém dados pessoais e hashes: mantenha privado, criptografado fora do host, sem Git, com retenção definida pelo Mestre. Não substitua um backup anterior sem necessidade.

Para restaurar: pare o servidor, preserve o diretório atual, restaure `hogwarts.sqlite` e `media/` do **mesmo** backup em um `DATA_DIR` vazio/privado, configure o caminho, execute migrações e inicie. Não misture arquivos `-wal`/`-shm` antigos com um snapshot restaurado. Teste uma restauração em ambiente isolado antes de depender da rotina.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Os testes de integração usam bancos temporários descartáveis. As credenciais em `tests/helpers.mjs` pertencem somente a essas fixtures e não são criadas no app real. Os testes de navegador usam Chromium e axe-core; capturam desktop de 1440 px e celular de 390 px, quatro Casas e fluxo de convite.

O navegador configurado por padrão é `/usr/bin/chromium`. Em outra máquina, instale Chromium e ajuste `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para o executável. A CI instala o navegador do Playwright e fornece esse caminho automaticamente.

Capturas e resultados: [docs/VALIDACAO.md](docs/VALIDACAO.md). Modelo e rotas: [docs/ARQUITETURA.md](docs/ARQUITETURA.md). Origem dos assets: [docs/VISUAL_V4.md](docs/VISUAL_V4.md).

## Limitações e próximas fases

- O mapa restaurado de Hogsmeade é **provisório**. O Mestre deve aprovar a qualidade/posições ou fornecer uma captura limpa fiel ao jogo. Há aviso no painel administrativo.
- F2.0a, F2.0b, F2.1, F2.2a, F2.2b e F2.2c estão implementadas: condução, PDFs individuais e concessões confirmadas de itens/prêmios narrativos. F2.3 entrega lojas, regiões, locais, ofertas privadas e mapas editáveis. F2.4 entrega pedidos, aprovação atômica de estoque/carteira e recibos privados, além de recompensas monetárias confirmadas.
- F3.0 entrega livros e aulas com páginas/liberações manuais. F3.1 entrega anos/data, calendário e grade. Faltam murais, Taça, coleções com revelações graduais, cartas, jornal, investigações e memórias. Essas rotas ainda têm estados vazios; não anunciam ações funcionais inexistentes.
- A tabela `publications` prepara futuras publicações; sem editor, envio ou marcação de leitura. Se uma publicação for inserida por uma futura integração, a leitura atual já filtra destinatários/contexto, sem efeitos colaterais.
- O jogador tem uma conta/um personagem. Não há seletor público de identidade. Contas MASTER administram os personagens e podem convidar outros Mestres; não precisam representar um personagem.
- Sem recuperação automática de senha, MFA ou troca de e-mail nesta entrega. Não reemita convite para uma conta existente como se isso recuperasse sua senha. A recuperação administrativa precisa ser implementada em fase própria.
- O sistema não transmite nada ao Discord nem ao Hub RPG. O inventário mecânico permanece exclusivamente no Hub.

## Planejamento complementar — Oficina Geral

A especificação completa das 15 oficinas foi comparada com a F0/F1. O [plano com matriz e contratos](docs/OFICINA_GERAL_PLANO.md) e o [backlog por fase, com dependências e testes](docs/BACKLOG_OFICINAS.md) ficam no repositório, com o inventário original preservado e os avanços registrados nas entregas. O planejamento mais recente organiza as próximas entregas em F2–F5 e prevalece sobre o resumo histórico F2–F4 acima.

Side-Quests/Histórias Individuais, Itens, Lojas e NPCs têm prioridade na F2. Cada módulo exige editor funcional no Painel do Mestre, persistência e leitura autorizada; uma página vazia não é uma oficina concluída. A PR #1 da fundação permanece preservada. F2.0a, F2.0b, F2.1 e F2.2a foram autorizadas e implementadas em branches/PRs próprias. O usuário autorizou concluir todas as etapas restantes sem nova confirmação entre fases. A F2.2b entrega condução, pistas e desfechos; a F2.2c entrega certificados/concessões e a F2.3 entrega Lojas e a F2.4 entrega carteira/pedidos e a F3.0 entrega livros/aulas e a F3.1 entrega calendário/grade e a execução segue para murais na F3.2. [Acompanhar todas as etapas](docs/EXECUCAO_COMPLETA.md).
