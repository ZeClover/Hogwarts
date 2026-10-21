# F2.3 — Regiões, locais, lojas e ofertas

A Oficina Geral tem quatro editores persistentes: **Regiões**, **Locais e marcadores**, **Lojas** e **Ofertas**. Cada um oferece busca, estado editorial, rascunho, publicação confirmada, duplicação, arquivo/restauração, histórico e prévia por personagem. As regiões/locais já existentes são migrados como perfis editáveis; não são criadas lojas, ofertas, preços ou mercadorias de exemplo.

1. Edite/crie a região com nome, descrição e base de mapa V4 ou imagem manual opcional. Publique a revisão. Na Central, configure destinatários e use **Abrir região** ou **Fechar região**; a operação conserva a distribuição configurada. Publicar o perfil não abre a região.
2. Crie o local vinculado à região, com imagem V4/manual, tipo, posição independente do mapa e destino. Local secreto continua exigindo liberação específica. Casa/turma/ano/exclusões restringem adicionalmente a consulta e prevalecem sobre grants legados.
3. Cadastre o estabelecimento, vincule o local e o NPC existente, escolha imagem facultativa, disponibilidade e se possui catálogo. Vincular comerciante não revela um NPC ainda desconhecido.
4. Crie cada oferta por ID de item e estabelecimento. Preço privado em Nuques e estoque opcional são próprios da oferta. O mesmo item pode ter preços distintos em várias lojas. Publicar item não cria oferta; publicar oferta exige item publicado.
5. O jogador explora **Acervos → Explorar regiões**, mapa e marcadores autorizados. Marcador de catálogo abre diretamente o estabelecimento quando existe um catálogo autorizado; o local mantém seus links de acesso. Hogsmeade usa a mesma base editável, preservando o mapa/identidade V4. Biblioteca abre o local, cujo leitor será integrado na F3.0.

O catálogo recebe somente nome, descrição e imagem do item publicado/autorizado, com cópia discreta da descrição. Não recebe preço interno, preço da oferta, estoque, condições ou notas administrativas, inclusive em buscas e URLs forçadas. Pedidos, aprovação, saldo e recibos são a próxima F2.4; não há botão de compra simulada neste corte.

Mídias manuais continuam privadas, com autorização pelo recurso e contexto. Assets V4 já públicos continuam ambientação pública; nenhum marcador secreto é desenhado no arquivo compartilhado. Novas regiões fechadas não enviam sequer nome/ID ao jogador. Os acessos e caminhos da fundação são preservados.

Migração aditiva `008_world_workshops.sql`: registros/revisões editoriais tipados, extensão dos perfis nativos e estoque independente. O serviço editorial aceita apenas categorias/esquemas registrados no servidor; campos, referências, políticas, versões e projeções são validados por domínio. Rascunhos não atualizam perfis nativos. Publicação é transacional e gera histórico. Republicar descrição/preço sem alterar o estoque configurado preserva o estoque restante; alterar explicitamente a configuração define uma nova quantidade.

Validação: cinco testes de servidor novos para migração, rascunhos, regiões fechadas, marcadores secretos, preço por loja, pesquisa sem vazamento, exclusões sobre grants antigos e conflitos. 103 testes de servidor/CLI aprovados na suíte completa e fluxo de navegador com criação dos quatro cadastros e mapa → catálogo; três fluxos de regressão de login/perfil/quatro Casas e acessos da fundação aprovados. Axe-core e overflow em celular/desktop. [Oferta no Mestre](screenshots/f2-3/oferta-desktop.png) · [Catálogo no celular](screenshots/f2-3/catalogo-mobile.png).

Sem alterações no Hub, merge, deploy, geração de imagens ou dados canônicos fictícios. F2.4 e as fases restantes permanecem autorizadas.
