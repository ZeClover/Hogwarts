# F3.3 — Taça das Casas

**Oficina Geral / Central → Pontos das Casas** permite iniciar a competição de um ano, lançar pontos positivos/negativos, consultar histórico privado, encerrar com vencedora escolhida e reabrir para correção justificada. Não há competição, pontuação ou resultado fictícios no seed.

Cada lançamento exige Casa, inteiro diferente de zero, motivo privado e confirmação. Personagem/evento são referências internas facultativas. Correções são novos lançamentos, preservando a trilha. Versão e chave idempotente impedem duplicidade ou perda entre duas sessões.

O jogador abre **Taça das Casas** e vê quatro ampulhetas, totais e ranking, além dos resultados publicados. Empates compartilham posição. Motivos, referências de personagem/evento, atores e ledger não integram a API pública. Consultar, estudar aula, comprar ou encerrar missão não concede pontos.

**Encerrar competição** exige escolher e confirmar a vencedora oficial. O sistema não transforma automaticamente a líder do ranking em campeã. O resultado guarda os totais daquele momento. Reabrir exige justificativa privada; correções posteriores e novo encerramento geram outro resultado, sem apagar o anterior. Trocar ano não modifica vencedores nem pontos antigos; seletor permite consultar o arquivo.

Migração aditiva `013_house_cup.sql`: competição por ano, lançamentos assinados com unicidade de operação e resultados em snapshots. Limites: ±1 milhão por lançamento e ±1 bilhão por total de Casa/ano. Sem pontos fracionários. Arquivos e relações são preservados entre anos.

Verificação: 130 testes de servidor/CLI aprovados; quatro testes novos cobrem autorização/CSRF, motivo privado, correção, repetição/concorrência, resultado manual, reabertura e continuidade anual. Fluxo de navegador inicia competição, lança +25/−5 e publica vencedora escolhida, com quatro ampulhetas, axe-core e 390/1440 px. [Editor no Mestre](screenshots/f3-3/taca-mestre-desktop.png) · [Taça no celular](screenshots/f3-3/taca-mobile.png).

Sem Hub, automação de recompensas, merge ou deploy. Próxima fase autorizada: F4.0a, coleções e revelações.
