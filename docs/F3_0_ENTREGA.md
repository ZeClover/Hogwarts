# F3.0 — Livros e aulas

**Oficina Geral → Livros e Biblioteca / Aulas** tem editores reais com título, sinopse, assunto, autor/professor por referência ao NPC, capa facultativa, campos avançados e páginas/capítulos reordenáveis. Aulas acrescentam ano letivo, nível Fundamentos/Prática/Aprofundamento, pré-requisitos informativos e exercícios opcionais. Não há sequência obrigatória, presença ou aprendizado automático.

Use **Adicionar Páginas e capítulos** para preparar o conteúdo. Cada página tem título, texto com negrito/itálico, imagem opcional e restrições adicionais. Os controles de formatação inserem a marcação suportada; o leitor escapa todo HTML antes de formatar. Scripts, atributos e links arbitrários não são executados. O editor guarda identidade estável da página; reordenação não a transforma em outro conteúdo.

**Salvar rascunho → Publicar** prepara a obra. No painel **Liberar páginas**, selecione páginas e destinatários; confirme **Revisar liberação**. Títulos, contagens, textos e imagens de páginas não liberadas não entram na resposta do jogador, busca ou mídia. As políticas da obra e página se somam; lote inválido não revela parcialmente. A apresentação pode ser silenciosa ou animada, com a fila persistente existente.

Republicar não substitui o snapshot que o jogador conhece; nova liberação confirma a atualização. Remover uma página da edição preserva conhecimentos já revelados até retirada explícita. Arquivo preserva os conteúdos autorizados. Duplicação gera novas identidades de página sem copiar revelações. Prévias e leitura não consomem fila, alteram auditoria do personagem, completam objetivos ou concedem moeda/posse/habilidade.

O jogador abre **Acervos → Biblioteca / Aulas**; a Biblioteca de Hogwarts também tem acesso ao leitor. Livros normais têm sinopse pública para o público autorizado e páginas manuais. Livros classificados como **Raridade** ficam fora do catálogo normal; acesso ao conteúdo exige liberação individual. A coleção de raridades da F4 reutilizará esse mesmo ID, sem duplicar texto ou conceder posse física. Nenhum livro pessoal de jogador é sobrescrito: o editor administrativo manipula somente obras oficiais deste domínio.

Migração aditiva `010_library.sql`: conhecimento por obra/página/personagem, snapshot, revisão de origem e evento de apresentação. Autoria/revisões usam o serviço editorial existente; imagens de página têm rota própria e autorização atual. Limites: 50 páginas por obra, texto de página até 16.000 caracteres e corpo JSON até 1 MiB. Até o calendário F3.1, ano letivo disponível 1890–1891.

Verificação: 115 testes de servidor/CLI aprovados na suíte completa; cinco testes novos cobrem três páginas, isolamento, políticas, imagens, prévia, snapshots, reordenação/duplicação, arquivo, raridade por referência e ausência de efeitos mecânicos. O fluxo de navegador cria/reordena três páginas, libera uma só, verifica formatação/HTML inerte e isolamento, com axe-core e 390/1440 px. [Editor desktop](screenshots/f3-0/biblioteca-editor-desktop.png) · [Livro no celular](screenshots/f3-0/livro-mobile.png).

Sem Hub, geração de imagem, seed de conteúdo, merge ou deploy. Próxima fase autorizada: F3.1, anos letivos, data narrativa, calendário e grade.
