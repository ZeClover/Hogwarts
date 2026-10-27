# Imagens, descobertas, ícones e senhas

Implementação incremental sobre `main` em `9c4fee076d1e97df101baf9d133a8a5e773b1b10`, na branch `feat/imagens-descobertas-senhas`.

## Preservado

Mantidos a arquitetura Node/TypeScript, os dados e relacionamentos existentes, a biblioteca de mídia privada, os arquivos aprovados de ambientação, os controles de publicação/permissões, as revisões e os snapshots. A navegação simplificada continua com cinco entradas para jogadores. Calendário continua fora dos menus; histórias pessoais continuam integradas às missões; selos continuam no Diário. Não foram recriados frontend, oficinas, contas nem sistema de notificações.

As imagens permanecem opcionais nos rascunhos. Uploads continuam limitados a JPG/PNG/WebP estáticos de até 2 MB, com validação de conteúdo e reprocessamento seguro. O Mestre continua escolhendo os destinatários e confirmando concessões; a apresentação visual não concede acesso, itens, moedas ou progresso.

## Galeria reutilizável

`Adicionar imagem` e `Alterar imagem` abrem uma galeria dentro do editor, com miniaturas, busca por nome sem distinção de acentos, filtro entre imagens do projeto e biblioteca do Mestre, upload, prévia, substituição e remoção. A escolha preenche os campos existentes; salvar/publicar mantém o fluxo anterior.

A galeria utiliza `workshop_files` e os endpoints privados já existentes. O catálogo novo é exclusivo do Mestre e não é carregado em sessões de jogadores ou em visualizar como personagem. Uma imagem enviada pode ser usada em várias criações sem outro upload. Imagens aprovadas do projeto são importadas pelo mesmo endpoint existente, quando escolhidas. Nenhuma imagem privada é convertida em arquivo público.

A melhoria é compartilhada pelos seletores dos editores de missões/pistas, NPCs, itens, livros/aulas e suas páginas, regiões/locais, lojas, coleções, Sapos, recordações, artigos do Profeta, anuários, retrospectivas e certificados. Recompensas vinculadas reutilizam as imagens dos itens/coleções; retratos próprios de jogadores mantêm o upload privado existente. Não foi criada uma galeria dos arquivos privados do Mestre para jogadores.

A migration `022_media_labels.sql` apenas acrescenta `display_name` com padrão vazio em `workshop_files`. Os nomes originais dos novos uploads ficam reutilizáveis e pesquisáveis. Arquivos antigos continuam funcionando; os títulos dos registros e as dimensões fornecem os nomes de apresentação quando necessário.

## Cartões e símbolos

O cartão de missão mantém estrutura, bordas, proporções e texto. A arte cadastrada aparece no topo como uma camada discreta com `object-fit: cover`, desfoque de 2 px e máscara em gradiente. A camada não altera o tamanho do cartão e termina progressivamente no fundo escuro. A mesma composição acompanha cartões compatíveis dos acervos; o detalhe do registro conserva a imagem nítida. Sem imagem, há ornamento discreto, sem arquivo aleatório. Fallbacks temáticos usam apenas artes públicas existentes e categorias adequadas, como biblioteca, aula e ambientação de lojas.

Foram desenhados **23 ícones temáticos vetoriais**: varinha, missão, livro, aula, criatura, penseira/recordação, coruja, carta, selo, poção, artefato, loja, local, castelo, chave, moedas, Taça, Profeta, Sapo, pena, personagem, acesso privado e curiosidade. Os traços dourados são simples, escaláveis, sem fontes de ícones ou downloads externos. Rótulos de texto permanecem visíveis; os SVGs decorativos não são anunciados repetidamente pelos leitores de tela. A tipografia serifada dos títulos e a fonte de leitura do portal foram preservadas.

[Catálogo dos ícones](icones-magicos.html).

## Auditoria e apresentações de descoberta

Já existiam `delivery_events`, SSE autenticado, reconhecimento persistente por personagem, histórico e resolvers de permissão. Porém, a apresentação usava textos genéricos, não animava a entrada, frequentemente não tinha imagem e não cobria liberações de missões, posses/recompensas e selos. Publicações do Profeta eram silenciosas, e os controles de páginas/coleções favoreciam a opção silenciosa.

Agora a mesma fila apresenta escurecimento, entrada curta, ilustração autorizada ou símbolo temático, identificação do tipo, título e resumo breve, além de **Ver mais detalhes** e **Fechar**. O primeiro abre o destino real; o segundo reconhece a apresentação sem marcar conteúdo como lido. O histórico `Revelações` permite recuperar o registro, sujeito às permissões atuais.

| Descoberta | Comportamento e verificação |
| --- | --- |
| Missão / Side-Quest | Evento na liberação ao participante; publicar um anúncio isoladamente não revela a missão. API e navegador online/offline verificados. |
| Pista / capítulo integrado | Resolver e snapshot existentes preservados; agora podem apresentar a ilustração autorizada. Regressões de pistas e histórias integradas mantidas. |
| Livro / aula | Evento quando o personagem ganha acesso, sem incluir páginas ocultas. API e jornadas de leitura verificadas. |
| Página / camada | Evento existente ampliado com imagem e rótulo; acesso ao registro e à página são conferidos separadamente. API e regressões do navegador verificadas. |
| Carta entregue | Evento existente preservado, agora com envelope e identificação. Entrega manual, destinatário e leitura móvel verificados. |
| Coleção / Sapo / curiosidade / raridade | Eventos e snapshots existentes reutilizados. Apresentação usa a imagem conhecida; referências ou publicações não concedem descoberta automaticamente. APIs e regressões de coleções/Sapos verificadas. |
| Recordação | Evento temático preserva texto individual e imagem autorizada. API e recompensa idempotente verificadas. |
| Criatura | Apresentação usa o registro descoberto; confirmação do encontro continua obrigatória. API e regressões de Bestiário verificadas. |
| Item recebido | Evento por posse concedida, incluindo compras confirmadas; não duplica junto ao evento de recompensa. Concessões e privacidade verificadas. |
| Recompensa narrativa / moedas | Evento por concessão confirmada. Coleções e itens usam sua apresentação própria para evitar mensagens duplicadas. API e regressões de concessão verificadas. |
| Selo de conclusão | Evento para os participantes registrados no desfecho; destino é o Diário, sem exigir PDF. API e regressão de selo verificadas. |
| Local / região | Detecta acesso recém-concedido, inclusive por grupo, preservando regiões fechadas, locais secretos e suas políticas. APIs e regressões de navegação verificadas. |
| Informação progressiva de NPC | Evento usa o snapshot revelado e o retrato autorizado; revogação remove a consulta. API e regressão do editor/jogador verificadas. |
| Profeta / anuário / retrospectiva | Publicação gera apresentação para o público efetivamente autorizado; retrospectiva continua exclusiva do titular. Capas e isolamento verificados por API, com regressões dos editores e leitura móvel. |

Não há nova apresentação a cada polling, leitura ou republicação administrativa. Comparações de acesso anterior/posterior e eventos idempotentes evitam anunciar novamente a mesma disponibilidade. Várias apresentações são serializadas por ordem de criação. Os caminhos de imagem na prévia do Mestre conservam `view_as`, respeitando o personagem selecionado.

A dispensa fica em `acknowledged_at`, por personagem. SSE sinaliza apenas IDs autorizados e é complementado por reconexão, retorno à aba e polling. Se a conexão cair ao fechar, um recibo local contendo somente IDs é guardado por personagem e sincronizado ao reconectar; não contém títulos, imagens ou textos secretos. A apresentação não reaparece enquanto esse reconhecimento aguarda sincronização. Dispensar uma apresentação não inicia missão nem modifica o registro descoberto.

Modais respeitam Escape, foco, rolagem em telas pequenas e `prefers-reduced-motion`. A escolha explícita de atualização silenciosa continua disponível para o Mestre.

## Senhas

Mínimo de **8**, máximo de **128** caracteres, sem exigir números, símbolos ou maiúsculas. Formulário de ativação, instruções e backend foram atualizados. Login continua aceitando senhas existentes, sem redefini-las. Scrypt, comparação segura, convites de uso único, origem, CSRF, cookies e limitação de tentativas foram preservados.

## Evidências visuais

Capturas reais em 1440 e 390 px, com verificações de overflow e acessibilidade Axe WCAG A/AA e 2.1 AA nas telas auditadas:

- [Cartões antes — desktop](screenshots/imagens-descobertas/cartoes-before-1440.png) e [celular](screenshots/imagens-descobertas/cartoes-before-390.png).
- [Cartões depois — desktop](screenshots/imagens-descobertas/cartoes-after-1440.png) e [celular](screenshots/imagens-descobertas/cartoes-after-390.png).
- [Galeria — desktop](screenshots/imagens-descobertas/galeria-1440.png) e [celular](screenshots/imagens-descobertas/galeria-390.png).
- [Revelação — desktop](screenshots/imagens-descobertas/revelacao-1440.png) e [celular](screenshots/imagens-descobertas/revelacao-390.png).
- [Ícones — desktop](screenshots/imagens-descobertas/icones-1440.png) e [celular](screenshots/imagens-descobertas/icones-390.png).
- [Acervos com ícones — celular](screenshots/imagens-descobertas/icones-acervos-390.png).

O baseline foi exportado do commit inicial desta etapa para uma pasta temporária, sem alterar a branch nem usar dados reais. `scripts/capture-visual-cards.mjs` reproduz os cartões e o catálogo de ícones com fixtures descartáveis. As capturas da galeria e das revelações são produzidas pela suíte dedicada.

## Validação final

| Verificação | Resultado final |
| --- | --- |
| `npm run build` | Aprovado: TypeScript, bundle e 42 imagens WebP válidas |
| `npm run lint` | Aprovado, sem erros |
| `node --test tests/*.test.mjs` | **210 aprovados**, 0 falhas, 0 ignorados, 0 cancelados |
| `node scripts/test-cloud.mjs` | **210 aprovados**, 0 falhas, 0 ignorados, 0 cancelados, SDK libSQL local |
| `npx playwright test --workers=3 --output=/tmp/hogwarts-final-e2e` | **79 aprovados**, 0 falhas, sem ignorados; 3,4 minutos |
| SQL de bootstrap | Regenerado para a migration 022; equivalência e repetição cobertas pelos testes |
| Capturas e acessibilidade | Galeria, cartões, revelação e acervos conferidos em 1440/390 px; Axe WCAG A/AA e 2.1 AA nas telas auditadas |
| Preservação das evidências anteriores | 53 capturas históricas sobrescritas pelas suítes foram restauradas; novas imagens ficaram em pasta própria |
| `git diff --check` | Sem problemas |

As primeiras execuções identificaram seletores que precisavam distinguir o conteúdo da nova janela, manejo da sequência de modais e uma expectativa antiga de ausência total de upload no criador de missão. Os testes foram atualizados para a experiência solicitada, mantendo verificações de privacidade, saldo, estoque, concessões e navegação. A suíte dedicada exerce as revelações sem dispensa automática; os fluxos de regressão fecham as apresentações incidentais pelos botões reais da interface.

Uma execução libSQL anterior coincidiu com escrita dos módulos compilados e teve um erro transitório de importação. A validação final compilou primeiro e manteve `dist` estável: ambas as suítes de 210 testes e os 79 testes de navegador concluíram sem falhas. Não execute builds enquanto suítes estiverem importando `dist`.

A suíte libSQL utiliza o SDK com arquivo local; não representa teste ou publicação em Turso/Blob reais. Não foi aplicado deploy nem acessado banco externo de campanha. As animações foram verificadas por APIs e pelas jornadas citadas; não se afirma uma captura visual individual de cada subtipo. Mudanças de permissões continuam prevalecendo sobre o histórico.
