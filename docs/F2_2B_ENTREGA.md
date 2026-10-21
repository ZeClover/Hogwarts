# F2.2b — Condução de missões

OF01-03/04/05: objetivos ordenados com seis estados manuais, etapas internas, pistas com destinatários próprios, resultados e reabertura auditada. Não concede recompensas nem emite documentos ao encerrar.

Na autoria da missão, crie objetivos e pistas, reordene e publique. Salvar ou republicar não revela conteúdo. Na seção **Condução da missão**, escolha a etapa, os destinatários e confirme a atualização. Cada objetivo pode ser opcional ou interno; cada pista tem texto, imagem facultativa, NPC/local por referência e política adicional. Notas administrativas nunca integram o Diário.

**Revelar agora** cria apresentação animada; **Atualizar discretamente** atualiza sem diálogo. Ambas persistem uma autorização e um evento individual em transação. O canal SSE autenticado sinaliza apenas IDs autorizados. A fila permanece para destinatários offline; reconhecer/rever uma apresentação não cria conhecimento, posse ou recompensa. Retirar acesso bloqueia consulta, imagem e repetição. Prévia não abre canal nem consome eventos. **Revelações** permite rever conteúdo ainda autorizado.

**Central da Sessão → Conduzir missões** lista missões abertas em andamento e oferece os mesmos comandos sem exigir navegar pela autoria. Encerrar exige escolher sucesso, sucesso parcial ou fracasso; epílogo e data narrativa são facultativos. Os resultados permanecem na jornada. Reabrir exige justificativa e conserva os resultados anteriores. Novos participantes e pistas continuam dependendo de confirmação explícita.

Migração aditiva `006_quest_operations.sql`: definições, progressos, revelações, resultados e outbox. Versão esperada, transações e auditoria em todos os comandos; lote inválido não produz alterações parciais. Snapshots de pistas só mudam mediante nova revelação. Resultados ordenados pela versão, inclusive ações no mesmo segundo. Nenhuma alteração no Hub ou nos assets V4.

Limites: até 50 objetivos e 50 pistas por missão; eventos consultáveis até 100 pendentes por lote e 30 no histórico recente. O conhecimento permanece no Diário independentemente desse limite de apresentação. Vínculos de coleção serão integrados quando a F4 existir.

Verificação: lint, build/typecheck, 92 testes de servidor/CLI e 13 fluxos de navegador (seis testes de servidor e um fluxo de navegador novos nesta fase) com três objetivos, apresentação online/offline, encerramento/reabertura, desktop/celular e axe-core. [Condução desktop](screenshots/f2-2b/conducao-desktop.png) · [Diário celular](screenshots/f2-2b/diario-mobile.png).

A autorização vigente abrange todas as etapas restantes. Próxima: F2.2c, certificados individuais e recompensas confirmadas. Carteira e coleções serão integradas nas fases correspondentes.
