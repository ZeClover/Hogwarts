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

Use Node 24.x, diretório raiz `./`, preset Other, instalação `npm ci --include=dev` e build `npm run build`. Não configure `dist` como diretório estático de saída. O `vercel.json` publica `api/index.mjs`, inclui os módulos compilados, recursos e migrations, e encaminha as rotas ao servidor. O runtime exige persistência remota e falha se faltarem configurações ou migrations; não cria SQLite no sistema efêmero da Vercel.

Em uma máquina autorizada, carregue as variáveis do ambiente desejado em `.env`, com acesso restrito ao arquivo. Primeiro faça backup do banco existente. Então execute:

```sh
npm ci
npm run db:migrate
npm run master:invite -- mestre@seu-dominio.com
```

As migrations são executadas explicitamente antes da publicação, fora de requisições e do build. O convite inicial é privado, expira em uma hora e só pode ser criado enquanto não houver um Mestre. Havendo campanha local, atualize primeiro essa instalação para as mesmas migrations, gere um novo backup e preserve a chave original. Restaure esse backup pelo painel após criar a conta e testar a instalação isoladamente. A recuperação mantém as contas, sessões e auditoria do destino; recrie os convites dos jogadores nesse ambiente.

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
