# Objetivos dentro da missão

A aba **Objetivos** permite criar e editar diretamente o título, a descrição revelada, as opções de objetivo opcional e etapa interna do Mestre, as notas privadas e as restrições de acesso. **Novo objetivo** e **Editar objetivo** abrem o formulário nessa aba; **Salvar objetivo** atualiza a lista sem navegar para outra página.

O formulário preserva seu conteúdo ao trocar de aba e ao salvar a história da missão. Salvar um objetivo mantém os campos ainda não salvos da história e das recompensas. Falhas de rede e conflitos de versão conservam o texto digitado; cancelar descarta somente essa edição. Os rascunhos ficam vinculados à missão e à sessão do Mestre.

São usados os mesmos objetivos, permissões, versões e APIs existentes. Não há alteração de banco ou migração. Reordenação, remoção com confirmação e progressos históricos continuam disponíveis. Missões arquivadas exigem restauração antes de editar. Os endereços antigos continuam acessíveis para links já existentes.

Salvar prepara o rascunho. Publicar a missão e atualizar o estado para os participantes continuam sendo ações explícitas. Nenhum objetivo é revelado ou concluído automaticamente; notas privadas permanecem reservadas ao Mestre.

## Validação

- Build e lint aprovados.
- 210 testes de servidor aprovados.
- 87 cenários de navegador verificados: 86 aprovados na rodada geral; o cenário restante passou na revalidação após delimitar a consulta ao título do catálogo, evitando a duplicidade com o diálogo de descoberta. A revalidação também repetiu os quatro cenários novos (5/5 aprovados).
- Quatro novos testes de navegador cobrem criação e edição no mesmo endereço, preservação de rascunhos, erros e conflitos, privacidade, atualização manual, reordenação, remoção e arquivamento.
- O teste existente de condução da missão usa o novo formulário e mantém as verificações de revelação, encerramento e reabertura.
- Acessibilidade WCAG A/AA e ausência de transbordamento horizontal verificadas em 1440 e 390 pixels.

Capturas: [desktop](screenshots/objetivos-na-missao/editor-1440.png) e [celular](screenshots/objetivos-na-missao/editor-390.png).

Os testes usam campanhas descartáveis. Esta validação não comprova uma publicação na Vercel.
