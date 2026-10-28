# Criador de quests — sete abas

A ficha de criação e edição segue o documento enviado em 28/10/2026. Principal, Secundária, Pessoal e Evento usam o mesmo editor. Basta o nome para salvar uma missão. O único **Salvar** permanece fixo junto das abas; Ctrl/Cmd+S usa a mesma ação. O salvamento é explícito, respeitando a preferência anterior por um único botão.

| Aba | Conteúdo |
| --- | --- |
| Identificação | Código único gerado ao salvar, nome, tipo, ano escolar de 1 a 7 ou não definido, período, NPC responsável, lugar onde foi obtida, localização principal livre, duração, dificuldade e status de planejamento |
| Descrição e Objetivos | Descrição ampla, objetivo principal, objetivos secundários e condições para iniciar; objetivos estruturados anteriores continuam disponíveis como ferramenta opcional |
| Personagens Envolvidos | Busca e galeria de NPCs existentes, retrato quando disponível, ficha em janela e criação de NPC no próprio editor |
| Desenvolvimento | Desenvolvimento narrativo e área livre de pistas e informações; as pistas publicáveis anteriores continuam disponíveis, herdando o acesso à missão |
| Desfechos | Sucesso completo, parcial, falha, abandono/recusa e decisões; encerrar ou reabrir a execução continua sendo uma operação separada |
| Recompensas | Prêmio principal, adicionais e descrição narrativa, vínculos de itens com quantidade, criação de item sem sair, planos de entrega e certificados existentes |
| Consequências | Personagens, Hogwarts, mundo, continuidade e protagonistas, todos opcionais e descritivos |

Os códigos MQ, SQ, PQ e EV são gerados na transação da missão. Uma cópia recebe outro código. Trocar o tipo depois não troca a identidade do registro. Missões antigas recebem o código ao salvar pelo editor, mantendo o UUID e os vínculos anteriores.

O NPC responsável aparece na galeria sem duplicação. A criação integrada usa as mesmas APIs e os mesmos cadastros de NPCs e itens do portal: cria um rascunho normal, sem publicar nem conceder algo. Remover um vínculo da ficha preserva o cadastro. Não há conexão nova com o Hub RPG nem cadastros paralelos.

Os campos narrativos usam texto com formatação simples: parágrafos, títulos, subtítulos, negrito, itálico e listas. A descrição, o desenvolvimento e as pistas livres aceitam até 120 mil caracteres por campo; os demais textos da ficha, até 40 mil. O formulário aceita até 2 MiB por pedido. HTML é escapado no modo de leitura. Os textos não executam testes, CDs, regras de Wands & Wizards, alterações em NPCs ou ações na campanha.

**Ler ficha** mostra os dados atuais do formulário na ordem das sete seções, inclusive antes de salvar. Campos opcionais vazios são omitidos. Voltar à edição conserva o texto digitado. O planejamento completo é reservado ao Mestre: ele não entra nas projeções dos jogadores, nem ao publicar. O resumo, o gancho e as pistas publicáveis dos jogadores continuam separados e disponíveis em suas ferramentas existentes.

Acesso, participantes, publicação, prévia por personagem e histórico ficam em uma seção recolhível na Identificação. Os textos e vínculos antigos continuam preservados. A lista de missões busca por nome ou código e filtra tipo, ano escolar, status de planejamento e estado editorial. A projeção administrativa completa é montada somente para os doze registros da página, evitando carregar todas as fichas longas para exibir uma lista.

## Recompensas e execução

Salvar ou marcar **Aprovada**, **Concluída** ou outro status na ficha não inicia ou encerra a execução e não entrega recompensas. O encerramento operacional e cada concessão exigem suas confirmações existentes.

Planos de itens aceitam quantidade de 1 a 999 por beneficiário. As moedas podem representar um valor por participante ou um total para o grupo. O total é dividido em Nuques inteiros igualmente; sobras vão aos primeiros IDs de personagens em ordem alfabética. O formulário mostra essa regra antes da confirmação. Planos antigos preservam o comportamento por participante e um item por pessoa. A confirmação continua atômica e não duplica a entrega se repetida.

Não há migração nova. A ficha é guardada no JSON privado existente, com validação no servidor e preservação ao salvar por clientes antigos. Não houve alteração direta no banco de produção.

## Validação

Build e lint aprovados. Os 218 testes de servidor passaram. Os dois cenários novos de ficha e concessão também passaram pelo SDK libSQL com banco em arquivo, sem serviços de produção.

Foram verificados 120 cenários de navegador: 116 passaram na rodada geral. Os quatro restantes foram corrigidos e passaram na revalidação final de 33 cenários, que incluiu os editores de missões, itens, NPCs e livros, criações, objetivos, recompensas, certificados, conflitos, uploads e autenticação. As duas capturas da ficha foram depois revalidadas em nova execução dos dois cenários específicos.

Os testes usam campanhas descartáveis e cobrem ficha longa, vínculos, código exclusivo, busca e filtros, clientes antigos e atualização parcial, privacidade, quantidade de itens, divisão monetária e repetição de concessão, criação integrada, leitura e acessibilidade em 390 e 1440 pixels.

Capturas: [desktop](screenshots/criador-sete-abas/editor-1440.png) e [celular](screenshots/criador-sete-abas/editor-390.png).

## Acesso à hospedagem

O HTTP 503 informado pelo usuário continua sendo uma falha da inicialização hospedada. A entrada compatível com Vercel já está na `main`; isso não confirma que configuração, banco e migrations da instalação real estejam disponíveis. A nova resposta distingue configuração ausente/inválida, banco sem atualização, conexão com o banco e inicialização da aplicação, sem retornar mensagens dos SDKs ou valores de credenciais. Veja os códigos e os passos operacionais no [guia da Vercel](VERCEL.md).

O ambiente de execução do Codex está conectado, mas não possui credenciais da Vercel ou do banco de produção e restringe o acesso ao domínio do site. A política de Internet do ambiente Codex não é a configuração de rede do site já publicado. Os avisos de limite de uso da conta e de publicação da configuração do ambiente são separados do HTTP 503. Não é possível confirmar a recuperação da produção somente com os testes locais.
