# F4.0b — Pacotes e cópias de Sapos

O Mestre edita cartas elegíveis e pools por temporada, com pesos e probabilidades por raridade. Publicar não distribui pacotes. Na Central, confirma destinatários, quantidade e origem/posse; cada lote congela as cartas autorizadas e suas probabilidades.

A abertura pelo dono usa `crypto.randomInt` no servidor: raridade ponderada, carta uniforme dentro dela. Repetição retorna o resultado persistido. Há uma cópia física por pacote; trocar a última cópia não apaga descoberta. Trocas entre dois donos exigem confirmação do Mestre, versões e chave idempotente. Retirada só de lacrados, com motivo privado. Nenhuma alteração no Hub.

Rotas: `/portal/mestre/sapos`, `/portal/sapos`, editor `chocolatepools`; APIs correspondentes `/api/master/chocolate` e `/api/chocolate`. Migration 015, snapshots por destinatário; políticas atuais continuam bloqueando bytes e abertura quando necessário.

Validação: 143 testes de servidor aprovados; fluxo Mestre → concessão → abertura no celular aprovado, Axe sem violações e sem rolagem horizontal. Capturas em `screenshots/f4-0b/`. Limite deliberado: negociação e confirmação da posse permanecem manuais; o site não simula compra ou troca automática.
