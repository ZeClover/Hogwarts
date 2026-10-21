# F4.0a — Cinco coleções e revelações

A Oficina Geral oferece cinco editores específicos: **Sapos de Chocolate**, **Bestiário Encantado**, **Biblioteca de Raridades**, **Recordações** e **Gabinete de Curiosidades**. Cada um tem os campos do domínio, imagens facultativas, políticas, versões, duplicação, arquivo e prévia. Publicar prepara o cadastro e não o revela; não existe catálogo canônico de exemplos, silhuetas ou totais secretos.

- Sapos: personagem/carta, apresentação/biografia, raridade, temporada, elegibilidade e camadas. O sorteio/pacote físico será implementado na F4.0b; conhecer uma carta neste corte não fabrica cópia física.
- Bestiário: espécie/classificação, imagem, planejamento privado de indivíduos notáveis e camadas. **Revisar descoberta** exige confirmar o encontro presenciado e selecionar observadores. Ler livro, abrir página ou receber referência não descobre espécie.
- Raridades: referência à obra extraordinária da Biblioteca existente. Não duplica o texto do livro. **Editar obra e liberar páginas** leva ao editor real da obra; descobrir a raridade não revela automaticamente páginas nem concede posse.
- Recordações: evento/narrativa/data, destinatários e texto individual por revelação. O mesmo acontecimento pode gerar registros pessoais diferentes; não é item de inventário ou troca.
- Curiosidades: objeto extraordinário, referência facultativa ao item e informações progressivas. Conhecimento não dá posse ou uso. Propostas de jogador dependem de aprovação, que cria rascunho administrativo; publicar/revelar continuam separados.

**Revelar registro** confirma destinatários e apresentação animada/silenciosa. **Revelar camadas** escolhe páginas de informação já publicadas para pessoas que conhecem o registro. A outbox persistente atende online/offline e replays não reaplicam conhecimento/recompensas. Retirar acesso bloqueia conteúdo, imagens e apresentações. Arquivar mantém a jornada de quem ainda está autorizado. Atualizações e duplicações não transferem conhecimentos automaticamente.

Jogadores usam **Acervos → Coleções / Recordações**. Cada registro oferece **Minhas anotações** para teorias e memória pessoal. As notas são isoladas por autor e recusam leitura/escrita pelo Mestre em prévia; não são copiadas para casos coletivos ou publicações. Editar em duas sessões protege a versão. A aplicação não declara teorias verdadeiras.

**Integrações narrativas:** o plano de recompensas agora seleciona coleção/recordação pela interface e concede conhecimento apenas após confirmação idempotente. Bestiário continua exigindo encontro confirmado; um lote inválido reverte inteiro. Pistas de missão podem referenciar coleção por ID, mas o nome/link só aparece se o personagem já puder consultar essa coleção. Associação não cria descoberta.

Migração aditiva `014_collections.sql`: descobertas/snapshots por pessoa, histórico de revelações, notas isoladas e propostas. Camadas reutilizam o mecanismo versionado de páginas e suas mídias protegidas. Sem moedas, habilidade, item físico ou sincronização do Hub por consulta. Certificados e recompensas narrativas têm seus domínios reais integrados; pacote/cópias de Sapos continuam na F4.0b.

Verificação: 139 testes de servidor/CLI aprovados; nove testes novos para cadastros ocultos, camadas, replay, encontro presencial, individualidade/notas, livro por referência, proposta como rascunho, mídia/política atual, recompensa idempotente/lote atômico e pista sem descoberta. Três fluxos de navegador aprovados na validação final, incluindo certificados e condução; o novo fluxo cria espécie/camada, confirma observador, revela e salva nota privada; regressão do leitor de livros, axe-core e 390/1440 px. [Bestiário no Mestre](screenshots/f4-0a/bestiario-mestre-desktop.png) · [Notas no celular](screenshots/f4-0a/anotacoes-mobile.png).

Todas as etapas restantes estão autorizadas. Próxima: F4.0b, probabilidades, pacotes e cópias de Sapos.
