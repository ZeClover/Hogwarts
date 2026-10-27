# F2.4 — Carteira, pedidos, estoque e comprovantes

**Central da Sessão → Carteiras e pedidos** oferece saldo de cada personagem, lançamento manual de crédito/débito, fila de pedidos e histórico financeiro privado. Não há saldos fictícios: cada carteira começa em zero. O Mestre informa G/S/N, uma descrição pública, motivo privado e confirma o lançamento. Correções são novos lançamentos, sem apagar o histórico.

No catálogo, **Adicionar à sacola** abre o pedido com quantidade. **Enviar pedido** registra a solicitação; não reserva estoque, debita saldo, entrega objeto ou completa objetivo. O Mestre vê saldo, estoque e referência privada por unidade, escolhe o **valor final total** e confirma a aprovação. Pode recusar com motivo privado; o jogador pode cancelar enquanto aguarda.

Aprovação verifica novamente publicação, destinatário, região/local, item, saldo e estoque. Débito, consumo e recibo acontecem na mesma transação. Duas confirmações do mesmo pedido retornam o mesmo resultado; duas compras disputando a última unidade produzem uma aprovação e uma recusa sem gravações parciais. Repetir uma aprovação com valor diferente é conflito. Valores são inteiros em Nuques, sem saldo negativo; 1 Galeão = 17 Sicles = 493 Nuques.

**Acervos → Minha carteira** mostra saldo, lançamentos públicos próprios e pedidos/comprovantes. O recibo contém nome, descrição, quantidade e valor efetivamente pago; não inclui preço de referência, preço interno, motivo privado ou data visível. Texto e imagem autorizados no momento da aprovação ficam preservados após fechar região/arquivar oferta. Imagem do recibo tem autorização própria por titular, sem dar acesso à loja ou ao arquivo de outro personagem. A cópia para uso manual contém apenas nome/descrição revelados e não altera o Hub RPG.

**Recompensas monetárias da F2.2c agora estão integradas.** O plano continua separado da concessão: confirmar aplica crédito ao ledger uma vez por plano/beneficiário. Emitir certificado ou encerrar missão não credita nada. Prévia de carteira/pedido é leitura pura e não solicita, aprova, cancela ou credita.

Migração aditiva `009_commerce.sql`: ledger com chave única de operação, pedidos versionados, solicitação idempotente e snapshot de recibo/mídia. Todos os comandos são autenticados, com origem/CSRF, papel e beneficiário validados no servidor. O valor absoluto de um lançamento e o saldo são limitados a 1 trilhão de Nuques. Quantidade por pedido: 1–99. Estoque vazio significa ilimitado; ausência de carteira não representa saldo inicial.

Venda direta opcional não foi incluída: o fluxo entregue é solicitação do jogador → decisão explícita do Mestre. Não há negociação automática, consumo, equipamento, reembolso automático ou sincronização de inventário. Se necessário, o Mestre registra correção financeira auditada como novo lançamento.

Validação: sete testes de servidor novos para saldos, autorização, CSRF, idempotência, concorrência de estoque, insuficiência, privacidade, imagem histórica e integração monetária; 110 testes de servidor/CLI aprovados na suíte completa e fluxo de navegador com crédito, sacola, aprovação e recibo. Três fluxos de navegador aprovados nesta validação, incluindo regressões de certificados e lojas; axe-core e 390/1440 px. [Central financeira](screenshots/f2-4/comercio-desktop.png) · [Comprovante no celular](screenshots/f2-4/comprovante-mobile.png).

F2 comercial está implementada. O aceite narrativo de coleções/recordações será concluído com os domínios da F4; nenhuma concessão fictícia substitui essa dependência. Próxima fase autorizada: F3.0, livros e aulas.
