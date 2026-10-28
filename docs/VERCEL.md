# Hospedagem na Vercel

O portal mantém as 15 oficinas, o Painel do Mestre, os controles de publicação manual e os assets V4. A opção local continua disponível. Na Vercel, os dados da campanha usam **Turso com libSQL** e os arquivos usam **Vercel Blob privado**. O banco em memória empregado na análise de importação é uma cópia descartável de validação; nunca armazena a campanha.

## Estado da publicação

O projeto informado é `hogwarts-1890`, no time **Zezin** (`zezin2`), ligado ao repositório `ZeClover/Hogwarts`. O deploy mostrado anteriormente usava o commit inicial `21903b4` da `main`, com a página provisória. Um status Ready desse commit não valida esta versão do portal.

A conexão disponível nesta sessão retornou 403 ao consultar o time `zezin2`: falta autorização para esse escopo. A correção depende de conceder acesso ao time correto. A permissão do app para ações de baixo risco é uma configuração separada. Nenhum banco, Blob ou segredo de produção foi criado nesta sessão. A verificação com serviços reais e o deploy permanecem pendentes desse acesso e do provisionamento.

## Recursos e variáveis

1. Crie um banco **Turso/libSQL**, com URL segura `libsql://…` ou `https://…` e token com permissão de escrita. A compatibilidade validada é com o cliente libSQL; uma engine diferente exige nova verificação.
2. Conecte um **Blob privado** ao projeto. Configure `BLOB_READ_WRITE_TOKEN` referente a esse mesmo store. Os envios diretos de arquivos precisam dessa credencial para assinar tokens limitados, mesmo quando o store oferece autenticação OIDC.
3. Configure as variáveis abaixo no ambiente Production da Vercel, usando o modelo [`.env.vercel.example`](../.env.vercel.example). Marque as credenciais como sensíveis. Não as coloque no Git, em capturas ou no chat.

| Variável | Valor ou finalidade |
| --- | --- |
| `NODE_ENV` | `production` |
| `PERSISTENCE_BACKEND` | `turso` |
| `APP_ORIGIN` | `https://hogwarts-1890.vercel.app`, ou o domínio final exato |
| `TURSO_DATABASE_URL` | URL segura do banco libSQL |
| `TURSO_AUTH_TOKEN` | Token privado do banco |
| `BLOB_READ_WRITE_TOKEN` | Token privado do Blob conectado |
| `HOGWARTS_STORAGE_PREFIX` | `hogwarts-production`, exclusivo deste ambiente |
| `BACKUP_ENCRYPTION_KEY` | 32 bytes aleatórios codificados em base64 |

Gere a chave de backup em um terminal privado e guarde-a em um gerenciador de segredos:

```sh
node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))'
```

Mantenha a mesma chave entre deploys. Perdê-la impede abrir backups antigos. A chave não é derivada da senha do Mestre. Para migrar uma instalação local com backups existentes, preserve a chave original de `data/backup.key`, convertendo seus 32 bytes para base64 em um terminal privado.

Para Preview, use **outro banco**, credenciais Blob separadas e outro prefixo/chave. Nunca habilite credenciais Production para todas as branches. Configure uma origem HTTPS estável para a branch de homologação e abra exatamente essa URL; cookies e verificações de origem não aceitam outro alias. Não execute migrations nem convites de testes no banco de produção.

## Preparação e deploy

Use Node 24.x, diretório raiz `./`, preset Other, instalação `npm ci --include=dev` e build `npm run build`. Não configure `dist` como diretório estático de saída. O `vercel.json` publica `api/index.mjs`, inclui os módulos compilados, recursos e migrations, e encaminha as rotas ao servidor. Essa entrada exporta uma função `(req, res)` que aguarda o listener HTTP existente. O runtime exige persistência remota e falha se faltarem configurações ou migrations; não cria SQLite no sistema efêmero da Vercel.

### Correção da entrada da API — 28/10/2026

A entrada anterior exportava um objeto `http.Server` sem chamar `listen()`. Esse formato não é reconhecido pelo carregador do runtime: ele aceita uma função, handlers Web ou um servidor capturado pela chamada a `listen()`. A recusa foi reproduzida com o carregador do pacote oficial `@vercel/node@28.0.0`, obtido do npm. A entrada corrigida foi reconhecida pelo mesmo carregador. Não foi adicionada uma dependência ao projeto.

A inicialização ocorre na primeira requisição e é compartilhada pelas requisições concorrentes do worker. Se falhar, responde HTTP 503 com `no-store` e permite outra tentativa, sem manter uma promessa rejeitada. A resposta e o log não incluem mensagens dos SDKs, URLs de conexão ou segredos. A tela interrompe o carregamento quando `/api/auth/context` falha, permitindo repetir sem ficar esperando também a consulta de sessão.

Build, lint, 215 testes de servidor e seis cenários de navegador passaram. Os testes exercitam a entrada exportada, login, cookies, origem, recuperação após falha e o botão de repetir após HTTP 500. A consulta direta ao site e aos logs da Vercel continua indisponível neste ambiente, cuja política de rede não libera o domínio; o defeito reproduzido não exclui uma falha adicional de configuração ou banco na instalação real. Se o novo deploy responder 503, confira os logs da função, as variáveis e as migrations antes de modificar dados.

O HTTP 503 posterior é tratado com códigos de diagnóstico. A tela de acesso mostra o código e, quando faltam variáveis, somente seus nomes. Nenhum valor privado ou mensagem bruta de SDK é retornado.

| Código | Verificação na instalação real |
| --- | --- |
| `CONFIGURATION_MISSING` | Configurar as variáveis listadas no ambiente Production do projeto correto e fazer novo deploy. Preservar a chave de backup existente. |
| `CONFIGURATION_INVALID` | Conferir origem HTTPS, persistência remota, formato da chave de backup e prefixo do armazenamento. |
| `DATABASE_MIGRATIONS` | Fazer backup e aplicar as 22 migrations no banco existente com `npm run db:migrate`. Não usar o bootstrap de banco vazio sobre uma campanha. |
| `DATABASE_CONNECTION` | Conferir URL do Turso, token, permissões, disponibilidade e acesso ao banco pela função. |
| `APPLICATION_INITIALIZATION` | Conferir os arquivos incluídos no deploy e os logs da função com o marcador `HOGWARTS_STARTUP_FAILED`. |

A configuração de Internet do ambiente Codex e um status Ready de build não validam esses recursos de produção. A resposta 503 continua bloqueando o acesso enquanto a dependência não estiver disponível; não existe fallback para banco vazio, senha alternativa ou liberação de autenticação.

Em uma máquina autorizada, carregue as variáveis do ambiente desejado em `.env`, com acesso restrito ao arquivo. Primeiro faça backup do banco existente. Então execute:

```sh
npm ci
npm run db:migrate
npm run master:invite -- mestre@seu-dominio.com
```

As migrations são executadas explicitamente antes da publicação, fora de requisições e do build. O convite inicial é privado, expira em uma hora e só pode ser criado enquanto não houver um Mestre.

### Primeira instalação pelo console SQL

Para um banco libSQL **novo e vazio**, [deployment/bootstrap-empty.sql](../deployment/bootstrap-empty.sql) reúne as migrations e o mesmo seed canônico da aplicação. O arquivo não contém tokens, senhas ou convites. Ele cria a estrutura e os cinco personagens; a conta do Mestre continua exigindo um convite privado separado.

Use um executor que envie o **script completo na mesma transação** e interrompa ao encontrar um erro. Confira a opção de execução de lote do console; um botão que executa apenas a instrução sob o cursor não basta. A consulta final deve retornar `migrations=22`, `casas=4` e `personagens=5` nesta versão. A proteção inicial recusa bancos que já tenham tabelas. Havendo erro, interrompa e faça rollback da transação antes de qualquer nova tentativa.

No console **Drizzle Studio** integrado ao Turso, use [deployment/bootstrap-studio.sql](../deployment/bootstrap-studio.sql). Esse console informa que já executa múltiplas consultas em uma transação e pode recusar os comandos externos de transação do arquivo genérico. A variante Studio omite somente o controle externo de transação e o PRAGMA de conexão, preservando todas as migrations, os dois gatilhos e o seed. Execute o texto inteiro como lote na transação do console. Se houver erro de análise ou de execução, pare e confira o estado do banco antes de tentar novamente. A versão sem transação externa não deve ser usada por um executor que aplique cada comando com commit individual.

O arquivo é gerado por `npm run db:bootstrap-sql` a partir das migrations e de um seed temporário, sem ler o banco da campanha. Os testes verificam que o arquivo publicado corresponde ao gerador e produz a estrutura esperada pelo cliente libSQL. Para atualizar uma instalação existente, use `npm run db:migrate`.

### Transferência de uma campanha local existente

A recuperação cifrada do painel preserva as contas do destino e exige vínculos compatíveis. Para transferir uma instalação existente, preserve os IDs originais das contas e dos arquivos por meio da cópia operacional completa, antes de criar contas no destino:

1. Pare o servidor local e execute `npm run backup -- /caminho/privado`. Preserve banco, `media/` e `backup.key` juntos.
2. Crie um banco libSQL novo e vazio a partir do SQLite dessa cópia: `turso db create hogwarts-production --from-file /caminho/privado/hogwarts.sqlite`. A [documentação oficial](https://docs.turso.tech/cli/db/create) limita esse arquivo a 2 GB. Configure as credenciais desse banco no destino.
3. Envie os arquivos de `media/` ao Blob privado mantendo cada nome, sob `HOGWARTS_STORAGE_PREFIX/media/`. Preserve os mesmos UUIDs; confira os arquivos antes de liberar o acesso.
4. Configure `BACKUP_ENCRYPTION_KEY` com os bytes da chave original em base64 e execute `npm run db:migrate` com as variáveis do destino. As contas existentes conservam seus IDs e hashes de senha; entre com essas contas, sem emitir outro convite inicial.
5. Teste a instalação isoladamente, incluindo imagens, PDFs, permissões e backup. Mantenha a cópia local intacta até concluir essa validação. Planos de revisão temporários precisam ser preparados novamente no destino.

Não aplique um backup cifrado antigo sobre um banco com contas recriadas e IDs diferentes: a verificação dos vínculos pode recusar a recuperação. Para uma campanha nova, use o fluxo de convite inicial descrito acima.

Publique a branch que contém esta adaptação ou integre as PRs na ordem das dependências antes de publicar `main`. Não use a `main` provisória como evidência de entrega das oficinas. A PR anterior e o Hub RPG permanecem preservados.

Após alterar variáveis, faça novo deploy. Confirme que ele aponta para o commit esperado.

## Persistência e limites

As transações usam um contexto separado por requisição, com operações atômicas de saldo, estoque, recompensas e emissão. Planos de importação/recuperação são cifrados no Blob e têm autor, expiração e controle de execução no banco; não dependem da memória de uma função. A aplicação confere o estado novamente dentro da transação antes de aplicar a revisão. Uma execução interrompida depois da confirmação exige nova análise, em vez de reaplicar o mesmo plano.

Mídia e PDFs continuam privados, servidos pelo servidor após autorização. As imagens mantêm os limites existentes de decodificação e regravação. Pacotes de conteúdo usam até 64 MB e recuperação até 128 MB. Na nuvem, arquivos de importação/recuperação vão diretamente ao Blob com token restrito a destino, tamanho, tipo e prazo; somente o ID preparado é enviado à função. A leitura posterior exige o mesmo Mestre. Downloads de arquivos da campanha usam streaming.

Uploads temporários expiram em dez minutos e são removidos no consumo ou durante a preparação de outro envio. Planos expirados também são limpos em operações posteriores. Sem novas operações, um arquivo órfão pode permanecer no Blob; monitore o armazenamento. Backups de segurança anteriores à aplicação são mantidos para recuperação.

SSE usa conexões autenticadas sem sobrepor consultas; pode ser encerrado pelo limite da função e reconectado pelo navegador. O polling continua disponível. A fila de revelações e os reconhecimentos ficam no banco, por isso uma reconexão não concede recompensas.

`npm run backup` é exclusivo da instalação local. Para nuvem, use backup cifrado no Painel do Mestre e retenção do provedor do banco. Guarde cópias fora do projeto e preserve a chave. Não remova os arquivos privados ao trocar um deploy.

## Verificação antes de abrir a campanha

Os testes automatizados locais e via SDK libSQL usam bancos temporários, sem credenciais de produção. O transporte de arquivo do SDK verifica SQL, transações e reabertura; não comprova conectividade HTTPS, latência do Turso ou autorização real do Blob.

Em homologação com os serviços reais, valide:

1. Ativação do Mestre e do jogador, logout e recusa sem sessão/CSRF.
2. Criação, edição e publicação de um conteúdo; envio de imagem e emissão privada de PDF.
3. Confirmação concorrente de uma recompensa e de uma compra sem duplicação.
4. Exportação, importação revisada e recuperação, incluindo arquivo acima de 4,5 MB.
5. Acesso em outro processo/deploy ao mesmo conteúdo e plano revisado, sem reaplicar uma confirmação.
6. Recusa de rascunhos, arquivos privados e referências não autorizadas ao jogador.
7. Produção e Preview em bancos e arquivos separados.

Somente após essa rodada e a conferência do commit publicado a hospedagem estará validada de ponta a ponta.
