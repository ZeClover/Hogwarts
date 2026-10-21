# F3.1 — Anos letivos, calendário e grade

**Oficina Geral → Anos letivos / Eventos / Grades** oferece editores reais com publicação, público, versões, duplicação, histórico e prévia. **Central → Data da campanha** separa a data em preparação da data publicada aos jogadores. O Mestre escolhe ano/data, salva e confirma a publicação; relógio real e recorrência jamais avançam a campanha.

Anos têm nome livre e ano inicial. Depois da primeira publicação, o ano inicial fica fixo para preservar referências; o nome pode ser revisado. Novo ano é aceito nos editores anteriores de missão, história, mídia e aula, inclusive filtros. O ano atual não pode ser arquivado antes de publicar outro como atual. Arquivo preserva a identidade dos anos antigos.

Eventos têm título, descrição, ano, data/horário narrativos, local, NPC e público. Modelos recorrentes ficam fora do calendário dos jogadores; duplicar e adaptar é uma ação manual. Não há geração de evento, presença, falta ou atraso automáticos.

Grades usam tabela com dia, horário, matéria, professor, sala e referência facultativa à aula. **Duplicar horário** copia a linha com nova identidade; o Mestre altera os campos desejados. Público por turma/Casa/ano e exceções usa as políticas existentes. Professores/salas não conhecidos não são revelados por associação. A tabela tem rolagem própria no celular, sem estourar a página.

O jogador abre **Calendário Escolar** e recebe somente data publicada, eventos e grades autorizados. Trocar ano não muda automaticamente o ano escolar do personagem e não apaga ou reinicia missão, carteira, livro, carta ou coleção. Conteúdo anterior conserva sua referência histórica; notas e trajetória não são recomputadas pelo calendário.

Migração aditiva `011_school_calendar.sql`: anos, estado de preparação/publicação e evolução segura da tabela legada `publications`, retirando o CHECK limitado a 1890/1891 e preservando suas linhas. O único ano inicial é o já existente 1890–1891; não há data/evento/grade fictícios de campanha.

Verificação: 121 testes de servidor/CLI aprovados; seis testes novos para migração com publicação legada, novo ano, preparação/publicação, acesso, modelos sem execução, duplicação, compatibilidade com autores anteriores, conflitos e continuidade de missão/saldo após troca de ano e reabertura do banco. Dois fluxos de navegador aprovados: criação de ano, publica data e edita/duplica grade pela tabela; regressão do leitor de livros. Axe-core e 390/1440 px. [Grade no Mestre](screenshots/f3-1/grade-desktop.png) · [Calendário no celular](screenshots/f3-1/calendario-mobile.png).

Sem mudanças no Hub/V4, merge ou deploy. Próxima fase autorizada: F3.2, murais e propostas de alunos.
