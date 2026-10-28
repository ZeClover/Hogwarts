# Editor da missão em abas, com um único Salvar

A edição fica nas abas **História**, **NPCs/locais**, **Objetivos**, **Pistas**, **Participantes**, **Desfechos**, **Recompensas**, **Certificados** e **Publicação**. Criar e editar objetivos, pistas, recompensas e certificados mantém o endereço da missão. Os vínculos usam os cadastros existentes; as imagens usam a galeria integrada. A emissão, consulta e liberação dos certificados também ficam nessa tela, preservando os PDFs e o histórico.

O único botão **Salvar** fica à direita das abas, numa barra que acompanha a rolagem abaixo do cabeçalho. No celular, as abas rolam na horizontal e o botão continua disponível. As abas podem ser trocadas sem perder o conteúdo digitado. Os botões locais de salvar foram retirados desse editor; Ctrl/Cmd+S usa a mesma ação.

Esse botão valida todos os formulários, inclusive nas abas ocultas, antes de enviar alterações. Ele salva a história e os vínculos, os objetivos e pistas abertos, a recompensa e o certificado em edição. Os pedidos usam as versões existentes e são sequenciais. Se um pedido falhar depois de outro ter sido concluído, os dados já salvos permanecem salvos e os formulários pendentes conservam seu conteúdo para corrigir ou tentar novamente, sem recriar registros que já foram salvos. O editor não declara sucesso para um salvamento incompleto.

Salvar não publica a missão, não concede recompensas e não emite ou libera certificados. As operações do Mestre continuam nas próprias abas. Alterações no acesso da missão e concessões de prêmios mantêm suas permissões e confirmações existentes.

## Pistas acompanham a missão

No novo editor, publicar a missão disponibiliza as pistas publicadas a todos os participantes que têm acesso a ela. Não há seleção de destinatários nem revisão de revelação por pista. Quem entrar depois recebe as pistas já publicadas. Um personagem sem acesso à missão não recebe o texto, as imagens ou os eventos de descoberta. A retirada do acesso à missão bloqueia também as pistas e suas imagens.

Notas privadas não são publicadas. Alterações em rascunho só chegam ao grupo após a publicação. As descobertas usam a fila persistente existente, sem repetir a apresentação em republicações ou liberações repetidas. Os vínculos de NPCs, locais e coleções continuam sujeitos às permissões desses registros.

As narrativas antigas mantêm os dados existentes. Salvar ou publicar pelo novo editor adota o acesso herdado das pistas para essa missão; os clientes antigos continuam disponíveis. Nenhuma migração ou alteração direta no banco de campanha é necessária.

## Evidências

Os testes usam campanhas descartáveis. As verificações incluem salvamento de cinco tipos de rascunho por um único botão, validação de abas ocultas, preservação após falha parcial, conflitos, emissão/liberação de PDF, acesso às pistas por participantes atuais e futuros, não repetição de eventos e isolamento de quem não participa.

Validação concluída:

- Build e lint aprovados.
- 212 testes de servidor aprovados.
- Os dois cenários de pistas compartilhadas também passaram com o SDK libSQL em arquivo local.
- 91 cenários de navegador verificados: 89 passaram na rodada geral de 90; o cenário que esperava oito abas foi atualizado para nove e passou na revalidação de sete cenários. O cenário adicional de upload lento também passou após aguardar o término real do envio e salvar a segunda missão.
- WCAG A/AA, largura de 390/1440 pixels, botão fixo durante a rolagem e ausência de transbordamento horizontal verificados.

Capturas: [desktop](screenshots/missao-abas/pistas-1440.png) e [celular](screenshots/missao-abas/pistas-390.png). A barra fixa e a acessibilidade são verificadas nas duas larguras. Publicação na Vercel depende do processo de hospedagem e não é comprovada pelos testes locais.
