# Modelo e rotas F0/F1

## Arquivos

| Caminho | Responsabilidade |
| --- | --- |
| `src/config.ts` | Origem, HTTPS, diretórios e porta |
| `src/db.ts` | Migrações, transações, seed e auditoria |
| `src/auth.ts` | scrypt, convites/sessões, CSRF, limitação de tentativas e preview |
| `src/access.ts` | Regras compartilhadas de região/local/publicação/mídia e DTOs filtrados |
| `src/server.ts` | HTTP/API, perfis, convites, painel e uploads privados |
| `src/cli.ts` | Migração, convite do primeiro Mestre e backup |
| `public/app.js` | Interface V4 conectada ao servidor, sem localStorage de identidade |
| `public/style.css` | CSS V4 preservado e ajustes de formulário, login e responsividade |
| `migrations/001_foundation.sql` | Esquema inicial com restrições de integridade |
| `tests/` | Integração HTTP, CLI e navegador real |

## Tabelas

| Tabelas | Dados |
| --- | --- |
| `houses`, `characters` | Brasão/sala comunal, nome, Casa, ano, biografia e retrato |
| `users` | E-mail único, hash scrypt, papel, personagem único e suspensão |
| `invites` | Hash do token, e-mail/papel/personagem, validade, consumo e revogação |
| `sessions` | Hash do cookie, CSRF, usuário e validade de 12 horas |
| `regions`, `locations` | Abertura, escopo, segredo, habilitação e marcador independente |
| `access_groups`, `group_members`, `access_grants` | Destinatários de região/local/publicação/mídia |
| `media` | Proprietário, chave privada aleatória, tipo e tamanho |
| `publications` | Estrutura futura, rascunho/publicado, ano 1890/1891, contexto/destinatários |
| `audit_log` | Autor, ação, alvo, detalhes operacionais e horário |
| `auth_limits`, `schema_migrations` | Controle técnico de tentativas e migrações |

Não há tabelas de preços, carteira, inventário mecânico ou pedidos: serão criadas com as migrações da F2. “Preparar” essa fase aqui significa manter rotas e entidades de locais extensíveis, sem simular transações.

## API

Mutações exigem origem exata, JSON (exceto upload) e CSRF da sessão. Autenticação/ativação exigem origem exata, limitação de tentativas e convite quando aplicável. Nenhuma query/cabeçalho do cliente atribui papel.

| Método / rota | Acesso / comportamento |
| --- | --- |
| `POST /api/auth/login` | Público; valida credencial, gera sessão nova |
| `POST /api/auth/activate` | Público; consome convite válido em transação |
| `POST /api/auth/logout` | Autenticado; revoga a sessão atual |
| `GET /api/session` | Sessão real e CSRF; nunca hash/senha |
| `GET /api/state` | Estado filtrado para usuário ou preview autorizado |
| `PATCH /api/profile[?character=id]` | Bio própria ou moderação do Mestre |
| `PUT/DELETE /api/profile/photo[?character=id]` | Foto própria ou moderação do Mestre |
| `GET /api/media/:id` | Arquivo privado autorizado; sem cache |
| `GET /api/locations/:id` | Valida região, local, segredo e destinatários; catálogo vazio |
| `GET /api/publications/:id` | Somente publicado/autorizado; sem marcar lido |
| `GET /api/master/state` | MASTER; configuração e últimas 100 ações |
| `POST/DELETE /api/master/invites[/:id]` | MASTER; criar ou revogar convite |
| `PATCH /api/master/accounts/:id` | MASTER; suspender/reativar PLAYER, revogar sessões |
| `POST/PATCH /api/master/groups[/:id]` | MASTER; criar/editar grupo e integrantes |
| `PATCH /api/master/regions/:id` | MASTER; abertura, escopo e destinatários |
| `POST /api/master/locations` | MASTER; criar contêiner secreto, sem produtos |
| `PATCH /api/master/locations/:id` | MASTER; visibilidade, segredo, destinatários, X/Y |
| `PATCH /api/master/characters/:id` | MASTER; nome, Casa e ano |

`view_as=id` existe apenas em GETs autorizados do Mestre. O servidor cria um Viewer com papel PLAYER e personagem alvo. Todas as mutações com essa query são recusadas, assim como os endpoints administrativos. A interface mantém a sessão MASTER e não envia uma sessão do personagem. A simulação não registra leitura, entrega, descoberta ou missão.

## Regras de visibilidade

- MASTER normal: administração e inspeção.
- PLAYER: região aberta **e** todos/destinatário autorizado.
- Local: região acessível **e** local habilitado **e** permissão. Segredos exigem grant específico independentemente de `audience=ALL`.
- Publicação: publicada, destinatário autorizado e eventuais região/local acessíveis. Rascunhos nunca aparecem em novidades.
- Foto: dono ou Mestre. A estrutura também admite grant de mídia ou publicação autorizada que a referencie.
- Oculto/inexistente: a API de detalhe retorna o mesmo 404 para não confirmar títulos/IDs. Acesso administrativo por PLAYER retorna 403.
- Rotas HTML de páginas são shell genérico sem conteúdo privado; a API fornece somente DTOs autorizados. Assets estáticos de ambientação são públicos.

## Rotas de interface

`/entrar`, `/ativar`, `/portal/inicio`, `/portal/hogwarts`, `/portal/hogsmeade`, `/portal/acervos`, `/portal/correio`, `/portal/perfil`, `/portal/mestre`, `/portal/local/:id` e `/portal/publicacao/:id`.

Contêineres futuros: `/portal/calendario`, `/portal/avisos`, `/portal/colecoes`, `/portal/missoes`, `/portal/investigacoes`, `/portal/recordacoes`, `/portal/profeta`. `/portal/casas` exibe apenas os brasões, sem pontos inventados.
