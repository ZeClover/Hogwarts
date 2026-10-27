# Hogwarts 1890 — Arquivos Mágicos

Portal privado da campanha, com os fluxos integrados de criação, sessão e Diário. A revisão das **25 áreas de simplicidade visual** está documentada em [REVISAO_COMPLETA_25.md](docs/REVISAO_COMPLETA_25.md). Mantém a fundação existente, a identidade visual V4 e a independência do Hub RPG. Conteúdo da campanha é criado no Painel do Mestre; não requer código novo para cada missão, objeto, carta ou livro.

[Guia completo do Mestre](docs/GUIA_DO_MESTRE.md) · [Matriz final e evidências](docs/F5_2_ENTREGA.md) · [Entregas por fase](docs/EXECUCAO_COMPLETA.md) · [Hospedagem na Vercel](docs/VERCEL.md)

A Central do Mestre prioriza criar conteúdo, entregar recompensas, ajustar carteiras, conferir pedidos e cartas e controlar pontos. Histórias pessoais são missões individuais. Lojas incluem seu catálogo; modelos e conjuntos de Sapos ficam nos seus editores. Anuários/retrospectivas pertencem ao Acervo/Diário; arquivos e auditoria ficam em Segurança e Backups. Calendário, eventos e grades foram retirados da interface, mantendo dados e APIs de compatibilidade.

Rascunho, publicação, revelação, emissão e concessão são separados. PDFs são individuais; carteira/estoque/recompensas e pacotes têm operações atômicas e proteção contra repetição. Rascunhos de cartas e notas pessoais permanecem privados dos autores, inclusive contra o Mestre. Publicação do Profeta é global; retrospectivas são individuais. Não há avanço automático do calendário nem resolução de teorias ou missões pelo site.

## Stack

**Node.js 24.x + TypeScript + HTML/CSS/JavaScript**, com SQLite nativo (`node:sqlite`) e arquivos privados para instalação local, ou **Turso/libSQL e Vercel Blob privado** para nuvem. `sharp` regrava imagens; `pdf-lib`/fontkit geram documentos individuais. O servidor HTTP, migrações, autenticação e autorização estão no projeto. A instalação SQLite local exige uma única instância e volume persistente; as funções Vercel usam persistência externa. `node:sqlite` também valida importações em uma cópia descartável e pode emitir aviso de API experimental no Node 24.

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

Para a Vercel, siga o [guia de configuração, migrations e publicação](docs/VERCEL.md). O deploy com serviços reais depende das credenciais e permissões do time; o guia registra o estado dessa validação. Não há envio automático de e-mail.

## Persistência, segurança e recuperação

SQLite com migrations transacionais e volume privado em `DATA_DIR`. Políticas e projeções são aplicadas no servidor a consultas, buscas, arquivos, relações, prévias e alterações. Prévia por personagem é somente leitura. Novidades/revelações usam fila persistente e SSE autenticado, com consulta periódica como apoio. Fotos e uploads são decodificados, limitados e regravados em WebP; imagens de carta não entram na biblioteca administrativa.

`npm run db:migrate` aplica migrations pendentes. Faça backup antes de atualizar; não há rollback automático. O seed mantém as quatro Casas, os cinco protagonistas e os contêineres confirmados da V4; não cria senhas, NPCs, produtos, estoque, saldos, cartas, edições ou missões fictícias.

A Oficina oferece exportação autoral/importação revisada como rascunhos e backup cifrado/recuperação da campanha. A chave fica em `DATA_DIR/backup.key` na instalação local ou em `BACKUP_ENCRYPTION_KEY` na nuvem; o Mestre não recebe rascunhos privados em texto legível. Recuperação preserva contas, sessões, convites e auditoria atuais. Regras e limites detalhados no [guia](docs/GUIA_DO_MESTRE.md).

Para cópia operacional, pare o servidor e execute `npm run backup -- /caminho/privado`. O comando abre o banco em modo somente leitura, sem executar migrations, e copia SQLite, `media/` e a chave de backup, quando existir. Guarde esse conjunto privado e cifrado fora do host. Para recuperar a instalação: preserve o diretório atual; restaure banco, mídia e chave do mesmo conjunto em `DATA_DIR` novo, sem WAL/SHM antigos; migre e teste isoladamente antes de iniciar o acesso real.

## Limites da entrega

O mapa de Hogsmeade permanece provisório artisticamente. O inventário do portal registra itens entregues em compras e recompensas confirmadas, na mesma transação. Comprovantes antigos não viram posse automaticamente; regras mecânicas externas do Hub continuam fora do portal. Não há chatbot, resposta automática de NPC, geração de imagens por IA, envio ao Discord, MFA ou recuperação automática de senha. A tabela legada `publications` não é o editor de notícias: os editores atuais possuem domínios e filas próprios. Deploy, domínio e merge não são executados por esta entrega.

O [planejamento inicial](docs/OFICINA_GERAL_PLANO.md) fica preservado como inventário histórico. O [backlog](docs/BACKLOG_OFICINAS.md) e a [matriz final](docs/F5_2_ENTREGA.md) registram a conclusão do escopo autorizado.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run test:cloud
npm run test:e2e
```

Os testes de integração usam bancos temporários descartáveis. `test:cloud` executa a mesma suíte através do SDK libSQL com transporte de arquivo; não substitui o teste nos serviços externos. As credenciais em `tests/helpers.mjs` pertencem somente a essas fixtures e não são criadas no app real. Os testes de navegador usam Chromium e axe-core; capturam desktop de 1440 px e celular de 390 px, quatro Casas e fluxo de convite.

O navegador configurado por padrão é `/usr/bin/chromium`. Em outra máquina, instale Chromium e ajuste `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para o executável. A CI instala o navegador do Playwright e fornece esse caminho automaticamente.

Capturas e resultados: [docs/VALIDACAO.md](docs/VALIDACAO.md). Modelo e rotas: [docs/ARQUITETURA.md](docs/ARQUITETURA.md). Origem dos assets: [docs/VISUAL_V4.md](docs/VISUAL_V4.md).
