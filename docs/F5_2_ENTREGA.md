# F5.2 — Modelos, arquivos e validação final

## Resultado

As quinze oficinas aprovadas possuem edição/operação funcional e persistente, com leitura autorizada correspondente. O caderno mantém a autoria dos jogadores e recebe moderação do Mestre. Não foram criados conteúdos canônicos fictícios, imagens de IA ou integração mecânica com o Hub. A fundação, as imagens V4 e as PRs anteriores foram preservadas; entregas encadeadas, sem merge ou deploy.

| Oficina | Implementação e evidência principal |
| --- | --- |
| OF-01 Missões / Histórias | `campaign`, `documents`, fila; F2.2a–c, moeda F2.4 e coleções F4.0a; testes campaign/quest-operations/documents |
| OF-02 Itens | Formulário público/avançado privado, efeitos e valores; F2.1, testes items |
| OF-03 Lojas / Regiões / Ofertas | Quatro editores, mapa, comércio atômico e comprovantes; F2.3–F2.4, testes world/commerce |
| OF-04 NPCs | Cadastro reutilizado, perfis e fragmentos autorizados; F2.0b, testes npcs |
| OF-05 Livros / Aulas | Páginas progressivas, leitores e aulas flexíveis; F3.0, testes library |
| OF-06 Coleções | Cinco editores, notas pessoais, revelações; F4.0a. Pools, pacotes e trocas F4.0b; testes collections/chocolate |
| OF-07 Correio | Composição exclusiva do autor, envio, fila e entrega manual; F4.1, testes mail |
| OF-08 Murais | Murais/avisos e propostas revisadas; F3.2, testes boards |
| OF-09 Calendário / Grade | Anos, data, eventos e tabela editável; F3.1, testes school |
| OF-10 Profeta Diário | Edições/artigos publicados globalmente; F4.2, testes journal |
| OF-11 Taça das Casas | Lançamentos privados, ranking público e vencedor manual; F3.3, testes cup |
| OF-12 Anuários | Geral público / retrospectiva por dono, resultado oficial congelado; F5.0, testes yearbooks |
| OF-13 Mídia / Modelos | Upload/corte/arquivos privados F2.0a; oito famílias reutilizáveis e arquivos F5.2; testes workshop/templates/archives |
| OF-14 Personagens / Permissões | Convites, perfis, Casas, grupos, turmas, lotes e prévia; F0–F2.0a e políticas dos domínios; testes security/workshop |
| OF-15 Investigação | Casos e contribuições dos jogadores, autoria, membros e moderação; F5.1, testes investigations |

[Guia de uso e rotas](GUIA_DO_MESTRE.md). [Entregas e PRs](EXECUCAO_COMPLETA.md).

## Modelos e snapshots

Editor `templates` na Oficina: famílias BOOK, LETTER, NEWSPAPER, CERTIFICATE, CREATURE, CARD, VITRINE e SCRAPBOOK; composição, borda/cor, cabeçalho e rodapé. Prévia contextual e seletores nos editores correspondentes. Apenas opções estruturadas, sem HTML/CSS arbitrário, URL externa ou geração de arte.

Migration 018 adiciona snapshots de modelo separados para rascunho/publicação. Carta guarda o snapshot no rascunho/enviado, coleção no conhecimento e pool, certificado na revisão/PDF. Alterar o modelo não modifica publicações ou PDFs anteriores. Campo novo facultativo, mantendo compatibilidade com registros existentes. Listas compartilhadas têm busca, estado e filtros de ano/categoria onde aplicáveis.

## Dados e recuperação

Painel `/portal/mestre/arquivos`, APIs `/api/master/archives`. Pacote autoral versionado com registros das oficinas compartilhadas e imagens referenciadas. A revisão trata IDs existentes com ignorar/copiar, revalida esquema/políticas/referências e decodifica/regrava imagens. Aplicar cria somente rascunhos, sem callbacks de publicação ou concessões. Modelos ainda não publicados e vínculos nativos requerem a revisão descrita no guia. Missões/NPCs/itens têm domínio próprio; jornadas operacionais são preservadas pelo backup completo.

O backup completo do painel usa AES-256-GCM com chave local privada e autenticação do formato. Assim, rascunhos de cartas e notas pessoais não se tornam leitura administrativa pelo arquivo baixado. A recuperação aceita somente a mesma instalação/migrations, valida tabelas, colunas, mídias e relações; preserva contas, convites, sessões e auditoria atuais. Desativação atual não é revertida. Hash do estado entre análise/aplicação evita restaurar sobre alterações posteriores sem revisão nova. Plano restrito ao Mestre criador, com expiração e uso único.

Antes da aplicação, há cópia cifrada em `DATA_DIR/recoveries/`; arquivos novos são removidos em falha. Imagens existentes com conflito de hash são recusadas. Backups operacionais CLI agora incluem a chave, quando presente, além de banco/mídia. Recuperação operacional em instalação nova e limites de tamanho estão no guia. Não existe importação do banco do Hub.

## Verificação

Testes cobrem privacidade de rascunho/histórico/imagem, publicação global versus individual, sorteio/abertura/troca, autoria/moderação, revisão de modelos e imutabilidade de PDF, importação sem publicação, conflitos/referências/mídia inválida, backup adulterado, recuperação de dados/imagens e manutenção de conta suspensa. Os bancos são temporários, sem dados reais da campanha.

A suíte de navegador inclui todos os módulos, desktop/celular, quatro Casas, convites/perfil e fluxos Mestre → jogador, com axe-core. Capturas novas em `screenshots/f4-0b/`, `f4-1/`, `f4-2/`, `f5-0/`, `f5-1/` e `f5-2/`; capturas das entregas antigas são preservadas. A verificação final de navegador também corrigiu leituras prematuras de URL nos testes e o encerramento de conexões SSE das fixtures.

Resultado final: **159 testes de servidor aprovados**, **27/27 cenários Playwright aprovados em execução sequencial** (6,8 minutos), lint e TypeScript aprovados, 28 WebP válidos com referências verificadas. A recuperação teve ainda sua bateria dirigida de 5 testes aprovada após o bloqueio explícito por versão de migrations. Axe sem violações nos fluxos auditados, com verificações de overflow em 390 px e capturas desktop/celular. As revisões remotas das PRs anteriores foram comparadas e permanecem inalteradas.

## Limites deliberados

Publicação e decisões narrativas continuam manuais. Estilos são estruturados, sem construtor HTML genérico. Pacote autoral importa rascunhos; recuperação cifrada repõe a campanha completa desta instalação e versão, sem importar credenciais de outro local. O mapa V4 continua aguardando aprovação artística. MFA, recuperação automática de senha, integrações externas e deploy não pertencem às quinze oficinas aprovadas.
