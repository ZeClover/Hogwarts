# F2.2c — Certificados individuais e concessões

Na missão salva, abra **Certificados e recompensas**. Prepare cada certificado com titular, nome completo, participação, ações, texto personalizado e desfecho. O modelo Pergaminho/Formal, a assinatura, data narrativa e ilustração/brasão são opcionais. Sucesso parcial e fracasso também permitem certificado.

**Salvar certificado** mantém rascunho. **Prévia do PDF** gera bytes sem emitir nem liberar. **Revisar emissão → Confirmar operação** guarda PDF imutável e snapshot da revisão; repetir não duplica a emissão. **Liberar PDF ao titular** é outra confirmação. Edições posteriores produzem novas revisões e documentos, preservando os anteriores. O Mestre pode retirar consulta sem apagar o arquivo emitido.

O titular consulta **Acervos → Documentos e recompensas**, baixa o PDF e pode autorizar explicitamente outros personagens. Somente o próprio titular altera esse compartilhamento; Mestre em prévia não pode fazê-lo. Sem autorização, colegas não recebem título, lista ou bytes. O documento liberado integra o arquivo pessoal, independentemente da abertura atual do local da missão.

Prêmios são planos separados: tipo, título/texto, beneficiários e referência ao item ou à futura coleção. Moedas podem ser planejadas em Galeões/Sicles/Nuques (493/29/1). **Revisar concessão** confirma o conjunto exato de beneficiários e aplica uma vez por plano/pessoa, em uma transação. Repetições concorrentes retornam a mesma concessão. Um destinatário inválido reverte o lote inteiro. Concessões confirmadas são imutáveis; uma nova decisão exige outro plano.

Este corte permite item publicado/autorizado e prêmio narrativo. O recibo de item guarda apenas nome/descrição publicados, sem efeitos secretos ou valores internos. A cópia para uso manual não altera o Hub. Carteira monetária será integrada na F2.4; coleções e recordações na F4. As dependências ficam explícitas no editor e bloqueadas no servidor até existirem. Encerramento, PDF, prévia e publicação jamais chamam uma concessão.

Migração aditiva `007_quest_documents.sql`: rascunhos/revisões de certificados, emissões privadas e planos/concessões com unicidade por beneficiário. PDFs ficam no banco privado e entram no backup existente, sem arquivos estáticos públicos. Renderização com [pdf-lib 1.17.1](https://pdf-lib.js.org/) e DejaVu Serif incorporada (licença em `resources/fonts`), texto paginado e ilustração opcional da biblioteca privada. Caracteres sem representação na fonte são recusados com mensagem de validação. PDFs não são documentos com marcação semântica de acessibilidade; a interface oferece rótulos e navegação por teclado.

Verificação: 98 testes de servidor/CLI aprovados, seis novos para PDF, privacidade, prévia, concorrência, compartilhamento e concessões; fluxo de navegador cria e baixa um certificado, concede prêmio e autoriza compartilhamento, com axe-core e 390/1440 px. [Editor desktop](screenshots/f2-2c/documentos-desktop.png) · [Titular no celular](screenshots/f2-2c/documentos-mobile.png).

As fases restantes estão autorizadas. Próxima entrega: F2.3, lojas, regiões, locais, ofertas e destinos no mapa.
