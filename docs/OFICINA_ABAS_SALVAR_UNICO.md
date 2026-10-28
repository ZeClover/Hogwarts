# Toda a Oficina em abas

Os editores ativos da Oficina agora usam abas na mesma página e um único **Salvar**, fixo à direita da barra de abas. No celular, as abas rolam na horizontal. Ctrl/Cmd+S executa o mesmo salvamento. Trocar de aba mantém os campos e arquivos selecionados.

| Área | Edição integrada |
| --- | --- |
| NPCs | Perfil, imagens, informações progressivas, acesso, publicação, prévia e histórico |
| Itens e imagens | Dados, imagens, informações reservadas, efeitos quando disponíveis, acesso e publicação |
| Conteúdos | Regiões, locais, lojas, ofertas, livros, aulas, jornais, quadros, avisos, cartas e conjuntos de Sapos, bestiário, raridades, memórias, curiosidades, anuários, retrospectivas e modelos |
| Lojas | Catálogo com criação e edição de ofertas dentro da loja |
| Modelos | Criar e editar o modelo vinculado dentro do editor que o utiliza |
| Raridades | Criar e editar a obra e suas páginas na própria aba |
| Sapos | Configurar conjuntos e probabilidades na tela de operações, em aba própria |
| Turmas | Um salvamento para os formulários alterados da seção de turmas |
| Correspondência do Mestre | Carta, destinatários, imagem, modelo e prévia |
| Investigações do Mestre | Moderação e aviso reservados no mesmo editor |
| Missões e histórias pessoais | Mantêm as nove abas e as pistas compartilhadas da [entrega anterior](MISSAO_ABAS_SALVAR_UNICO.md) |

Os editores relacionados, como uma oferta dentro de uma loja, conservam seus próprios campos e abas, mas usam o **Salvar** da página principal. O endereço do navegador permanece o da criação original. O botão de cancelar fecha somente a edição relacionada.

O salvamento valida os formulários alterados, inclusive em abas ocultas, e envia os pedidos em sequência com as versões existentes. Não exige preencher uma informação nova vazia de NPC ou uma turma nova vazia. Uma falha mantém os campos pendentes e abre a aba correspondente. Formulários já salvos não são enviados novamente na tentativa seguinte. Uma resposta atrasada não substitui o registro aberto depois.

Salvar mantém o estado editorial: publicar, conceder itens, movimentar dinheiro, revelar informações progressivas de NPCs, entregar cartas e pacotes continuam sendo operações explícitas. As permissões e os dados privados continuam verificados pelo servidor. A prévia usa a revisão salva sem apagar a edição ainda não salva.

Calendário, eventos e grades continuam retirados da interface conforme a revisão anterior, com seus dados e APIs preservados. As criações rápidas mantêm sua ação inicial de criar; depois usam o editor com o botão único. Os formulários pessoais de jogadores mantêm seu fluxo próprio.

## Mensagem de erro no acesso

A mensagem mostrada no site aparece quando a consulta a `/api/auth/context` falha e o navegador não consegue conferir o endereço principal de autenticação. A tela agora distingue erro HTTP, demora e falha de conexão. **Tentar novamente** refaz a verificação sem perder o fragmento do convite. O campo de senha continua disponível somente após a validação do endereço.

A causa específica da falha em produção não foi confirmada: o proxy deste ambiente respondeu 403 ao tentar conectar ao domínio público da Vercel, antes de alcançar a aplicação. Isso não é evidência de que a Vercel esteja devolvendo 403 ao usuário. A entrega não altera credenciais, banco de campanha ou configuração da hospedagem.

## Validação

Os testes usam bancos descartáveis. A validação cobre persistência em todas as famílias ativas, editor relacionado com salvamento único, falhas parciais, resposta lenta, publicação separada, permissões e regressões dos fluxos existentes.

- Build e lint aprovados.
- 212 testes de servidor aprovados.
- 116 cenários de navegador verificados: 115 passaram na rodada geral; o cenário de missões encontrou dois títulos iguais no cartão e no aviso de descoberta. Seu seletor foi delimitado ao cartão, e a revalidação final de 30 cenários passou por completo.
- A revalidação inclui todos os novos editores, catálogo e modelos, prévia sem perda de edição, moderação com um único Salvar, correspondência e os quatro cenários de missões.
- WCAG A/AA e largura de 390/1440 pixels verificados no editor com modelo integrado.

Capturas: [desktop](screenshots/oficina-abas/loja-1440.png) e [celular](screenshots/oficina-abas/loja-390.png). Os testes verificam WCAG A/AA e ausência de transbordamento horizontal nessas larguras. Não há migração nova ou alteração direta em dados da campanha. Testes locais não confirmam publicação na Vercel.
