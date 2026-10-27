# F4.1 — Correio com entrega manual

Compositor em `/portal/correio/nova`, caixa e arquivo por autor/destinatário em `/portal/correio`, fila em `/portal/mestre/correio`. Texto, assinatura, destinatários reais, NPC remetente ou anonimato pelo Mestre, ano e modelo visual; imagem opcional sanitizada. Rascunhos têm versões exclusivas do autor, inclusive após o envio: o Mestre lê a versão enviada, nunca o histórico privado. Anexos de rascunhos não entram na biblioteca administrativa. Duplicar cria novo rascunho. Arquivar a própria caixa preserva o arquivo do destinatário.

Enviar não entrega. Mestre confirma entregar/reter/devolver/extraviar com versão; motivos ficam privados. Entrega gera fila persistente, repetir não duplica. NPC não responde nem recebe conhecimento automaticamente. Prévia é somente leitura. Migration 016 guarda imagens privadas no banco e não publica caminhos de disco.

Validação: 146 testes de servidor aprovados, incluindo texto/histórico/imagem contra Mestre, colegas e prévia; entrega concorrente/CSRF/versionamento. E2E de composição → envio → entrega → celular aprovado; Axe sem violações, sem overflow. Capturas em `screenshots/f4-1/`.
