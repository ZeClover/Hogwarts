# Recompensas dentro da missão

A aba **Recompensas** do editor de missão agora contém a lista e os formulários reais de recompensas. O botão do cabeçalho abre essa mesma aba. Criar, editar, salvar e revisar a entrega mantêm o endereço da missão; a edição não exige abrir a página de documentos.

São reutilizadas as APIs existentes de planos e concessões, com os mesmos IDs, versões, permissões e recibos. Não houve migration nem alteração no modelo de dados ou nas regras de concessão.

O Mestre pode preparar e editar prêmios narrativos, itens, moedas, coleções e recordações. Os campos de referência e moedas aparecem conforme o tipo escolhido. Salvar não entrega o prêmio. **Revisar entrega** mostra os beneficiários e exige **Confirmar entrega**, registrando a concessão uma única vez. Recompensas já concedidas continuam no histórico como recibos preservados.

A aba carrega os dados quando é aberta e apresenta erro recuperável com **Tentar novamente** em caso de falha. Conflitos de versão mantêm o texto digitado. Trocar de aba ou salvar a autoria da missão preserva o formulário de recompensa; alterações ainda não salvas da missão também permanecem ao salvar uma recompensa. A lista de beneficiários acompanha participantes acrescentados durante a edição, sem apagar o rascunho nem selecionar novos alunos automaticamente.

A atualização do painel modifica somente o conteúdo da aba. A navegação entre missões reinicia o contexto e respostas antigas são ignoradas. A rotina de consulta do portal mantém a verificação de sessão e protege o formulário em edição. Os certificados anteriores continuam acessíveis em uma seção secundária, usando o fluxo já existente.

Verificação funcional em fixtures descartáveis:

- Lista existente, edição e persistência sem mudar a URL.
- Campos não salvos preservados entre abas e após salvar a missão.
- Novos participantes disponíveis sem perder o rascunho.
- Item e moedas entregues uma única vez após confirmação.
- Edição de recordação para coleção e entrega dos dois tipos.
- Falha de carregamento, repetição, conflito de versão e isolamento entre missões.
- Regressão de documentos, certificados, missões, permissões e recompensas existentes.
- Acessibilidade Axe WCAG A/AA e 2.1 AA e ausência de overflow nas telas auditadas em desktop e celular.

Resultados finais:

| Comando | Resultado |
| --- | --- |
| `npm run build` | Aprovado: TypeScript, bundle e imagens verificadas |
| `npm run lint` | Aprovado, sem erros |
| `node --test tests/*.test.mjs` | **210 aprovados**, 0 falhas ou ignorados |
| `npx playwright test --workers=3 --output=/tmp/hogwarts-inline-e2e-final` | **83 aprovados**, sem falhas ou ignorados |
| Edição inline e missões, execução direcionada | **8 aprovados**, incluindo os quatro novos testes |
| `git diff --check` | Sem problemas |

A primeira rodada identificou uma condição de corrida no helper dos testes ao tentar fechar uma revelação que já havia desaparecido por revogação de acesso. O helper agora só tolera essa ausência legítima e continua falhando se a janela permanecer visível e não puder ser fechada. A execução completa final passou. As capturas históricas sobrescritas pelos testes foram restauradas; as novas evidências ficam em pasta própria. Nenhum teste foi desativado.

Capturas:

- [Lista — desktop](screenshots/recompensas-na-missao/lista-1440.png) e [celular](screenshots/recompensas-na-missao/lista-390.png).
- [Editor — desktop](screenshots/recompensas-na-missao/editor-1440.png) e [celular](screenshots/recompensas-na-missao/editor-390.png).

Reprodução: compilar com `npm run build`, executar `npm run lint` e depois `npx playwright test tests/inline-rewards.e2e.spec.mjs --workers=2 --output=/tmp/hogwarts-inline-rewards`. Os testes geram as capturas em pasta própria. Não recompilar `dist` durante execuções de testes.
