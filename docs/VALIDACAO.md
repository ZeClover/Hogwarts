# Evidências de validação F0/F1

Verificado em 21/10/2026, Node.js 24.19.0, Chromium headless. Os testes usam bancos SQLite temporários e os removem ao terminar; não deixam usuários, convites, cartas, artigos ou narrativa no banco da aplicação.

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou; TypeScript e decodificação das 28 imagens WebP |
| `npm run lint` | Passou, sem erros |
| `npm run typecheck` | Passou, modo strict |
| `npm test` | 22 testes de integração HTTP, segurança e CLI passaram |
| `npm run test:e2e` | 3 fluxos completos no Chromium passaram |
| axe-core WCAG 2 A/AA e 2.1 A/AA | Nenhuma violação automática nas telas examinadas |
| Desktop 1440 px e celular 390 px | Sem overflow horizontal nas telas examinadas |
| Teclado / redução de movimento | Link de salto alcançável por Tab e animações desativadas com preferência de redução |
| `npm audit --omit=dev --audit-level=high` | Nenhuma vulnerabilidade reportada nas dependências de execução |

A checagem automática de acessibilidade não substitui auditoria manual completa com leitor de tela. As capturas mostram a implementação com fixtures, não uma campanha publicada.

## Aceite coberto

| Critério | Evidência |
| --- | --- |
| PLAYER não administra nem força papel via query/cabeçalho | Integração: 403 nas APIs MASTER e em tentativa de elevação |
| Região fechada sem metadados de lojas | Integração: DTO sem títulos/IDs/imagens de locais e detalhe 404 |
| Região por personagem/grupo | Integração: permissões reavaliadas após alteração de integrantes |
| Segredos não aparecem ao abrir região | Integração: exige grant específico; região fechada e local desativado prevalecem |
| Preview realmente limitado e sem escrita | Integração: resposta PLAYER, bloqueio de mutações, snapshots de sessões/auditoria idênticos |
| Quatro Casas com atualização sem reload | Navegador: tokens, brasão e sala corretos; estado da janela preservado |
| Biografia/foto próprias e moderação | HTTP e navegador: persistência após reload, upload regravado, remoção e negação de outro jogador |
| Upload seguro | HTTP: assinatura/MIME, tamanho, SVG disfarçado recusado, EXIF removido, arquivo privado |
| Novidades autorizadas | HTTP: rascunhos, outro destinatário e contexto inacessível filtrados |
| Convites seguros | HTTP: expiração, revogação, e-mail vinculado e consumo concorrente de uso único |
| Onboarding de verdade | Navegador: Mestre gera link, outro contexto aceita e passa a ser PLAYER vinculado |
| Sessões | HTTP: hash no banco, cookie HttpOnly/Strict, CSRF/origem, expiração/logout/suspensão |
| Estados vazios | Navegador/HTTP: novidades, bibliotecas e catálogos sem dados fabricados |
| Primeiro uso e backup | CLI real: migração, convite inicial e backup de banco/mídias em diretório temporário |

## Capturas

- [Entrada desktop](screenshots/login-desktop.png)
- [Início desktop](screenshots/inicio-desktop.png)
- [Início celular — 390 px](screenshots/inicio-mobile.png)
- [Grifinória](screenshots/casa-gryffindor.png), [Lufa-Lufa](screenshots/casa-hufflepuff.png), [Corvinal](screenshots/casa-ravenclaw.png), [Sonserina](screenshots/casa-slytherin.png)
- [Central do Mestre desktop](screenshots/mestre-desktop.png)
- [Central do Mestre celular](screenshots/mestre-mobile.png)
- [Hogsmeade fechada no celular](screenshots/hogsmeade-fechada-mobile.png)
- [Hogsmeade aberta para personagem autorizado](screenshots/hogsmeade-desktop.png)
- [Olivaras no celular — catálogo vazio](screenshots/olivaras-mobile.png)

## Pendências explícitas

Mapa/posições de Hogsmeade aguardam revisão do Mestre. Instalação privada com HTTPS/volume e política de backup ficam documentadas, sem deploy nesta entrega. SQLite requer uma instância com volume persistente. Recuperação automática de senha/MFA não estão presentes. F2–F4 continuam no planejamento, sem comércio, carteira, correio, progressão ou missões completos.
