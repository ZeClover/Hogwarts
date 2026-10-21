# F3.2 — Murais, avisos e propostas

**Oficina Geral → Murais / Avisos** oferece cadastro, público, publicação, arquivo, histórico e prévia. O mural tem local obrigatório e Casa facultativa; avisos têm título/texto, autoria, categoria, data narrativa, ilustração opcional e referência a oportunidade de missão.

O jogador consulta **Hogwarts → Quadros de Avisos** ou os links do local. Marcadores podem abrir um mural autorizado diretamente. Fechar a região/local ou restringir a Casa bloqueia mural, avisos, buscas e bytes das ilustrações. Somente avisos publicados aparecem no quadro. A referência à missão abre Oportunidades e não libera/inicia participação.

**Propor aviso → Enviar para aprovação** registra texto de aluno como aguardando; colegas não recebem a proposta. O autor acompanha e revisa suas próprias propostas. **Central → Propostas de avisos** permite ao Mestre revisar e confirmar aprovação/publicação ou recusar com motivo privado.

Aprovação preserva autoria pelo ID do personagem. Editar uma proposta aprovada volta à revisão; a publicação anterior continua com o texto já aprovado até nova confirmação. Edições concorrentes retornam conflito e preservam o texto do aluno. Repetir a aprovação não cria outro aviso ou revisão. Uma edição administrativa pendente do aviso precisa ser resolvida antes da nova aprovação; a moderação não a sobrescreve silenciosamente. O Mestre pode arquivar o aviso pelo editor, sem apagar proposta ou histórico.

Migração aditiva `012_boards.sql`: propostas por autor/mural, versões e histórico. Conteúdo publicado usa registros/revisões editoriais existentes. Contas PLAYER não moderam; prévia não envia nem aprova. Motivos privados de recusa não aparecem ao jogador. Nenhum conteúdo é importado automaticamente de diário, teoria ou segredo.

Verificação: 126 testes de servidor/CLI aprovados; cinco testes novos para local/Casa, mídia, publicação, autoria, edição com nova revisão, CSRF, idempotência, conflito e anúncio sem matrícula. Fluxo de navegador cria mural, recebe proposta, aprova e reaprova texto revisado, com isolamento, axe-core e 390/1440 px. [Moderação](screenshots/f3-2/moderacao-desktop.png) · [Mural no celular](screenshots/f3-2/mural-mobile.png).

Sem alterações no Hub/V4, merge ou deploy. Próxima fase autorizada: F3.3, Taça das Casas.
