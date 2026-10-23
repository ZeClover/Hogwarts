// Only describes existing controls. It never submits, fetches, or changes state.
const prepare='Confere os campos e marca o rascunho como preparado, sem publicar. Esta etapa é opcional.';
const restore='Volta à edição como rascunho, sem publicar uma nova revisão.';
const duplicate='Cria uma cópia privada para editar; não altera o original nem copia liberações.';
const preview='Mostra a leitura do personagem escolhido, sem publicar, revelar ou conceder nada.';
const save='Salva o rascunho. A versão publicada só muda quando você publicar novamente.';
const confirm='Executa a operação descrita acima. Confira o efeito e os destinatários antes de confirmar.';
const cancel='Fecha esta confirmação sem executar a operação.';
const actions={
 npcAction:{prepare,'ask-publish':'Abre a confirmação para publicar o perfil ao público escolhido. Informações progressivas continuam separadas.','ask-archive':'Oculta o perfil dos jogadores e preserva cadastro e histórico para restaurar depois.',restore,duplicate,'ask-remove':'Revisa a remoção desta informação do rascunho; não apaga a versão já publicada.',publish:'Publica o perfil salvo para o público escolhido, sem revelar informações progressivas.',archive:'Retira o perfil da consulta dos jogadores, sem apagar seu histórico.',remove:'Remove esta informação do rascunho; a publicação só muda ao republicar.',cancel},
 itemAction:{prepare,'ask-publish':'Abre a confirmação para liberar a descrição ao público escolhido. Não cria oferta, posse ou recompensa.','ask-archive':'Retira o artigo da consulta e de novas ofertas; preserva o cadastro e o histórico.',restore,duplicate,publish:'Libera a revisão salva do item, sem vender ou entregar o objeto.',archive:'Arquiva o item sem apagar seu cadastro ou registros anteriores.',cancel,'effect-add':'Acrescenta um efeito interno ao formulário. Salve para guardar; não aplica mecânicas.','effect-remove':'Remove este efeito do formulário; salve para guardar a alteração.'},
 workshopAction:{prepare,'ask-publish':'Abre a confirmação para mostrar esta imagem aos destinatários escolhidos.','ask-archive':'Retira este registro da galeria dos alunos. Não apaga o arquivo original.',restore,duplicate,publish:'Publica a revisão salva desta imagem para seus destinatários.',archive:'Arquiva o registro da galeria, preservando o arquivo e o histórico.',cancel},
 campaignAction:{prepare,'ask-publish':'Abre a confirmação da publicação. Participantes, capítulos e pistas são liberados separadamente.','ask-archive':'Guarda a jornada no arquivo; o que já foi revelado continua no Diário dos participantes.','ask-restore':restore,duplicate,'ask-release':'Revisa a liberação do arco ao protagonista, sem revelar seus capítulos.','ask-revoke':'Revisa a retirada de acesso ao arco; preserva o registro e o histórico.','edit-entry':'Abre o editor de uma entrada. Salvar e revelar são etapas separadas.','ask-reveal-entry':'Revisa a revelação do texto publicado ao protagonista.','ask-revoke-entry':'Revisa a retirada desta entrada da leitura do protagonista, sem apagar o histórico.','ask-remove-entry':'Revisa a remoção do rascunho; o que já foi revelado não é apagado.','definition-edit':'Abre o editor de objetivo ou pista; não atualiza os participantes automaticamente.','ask-remove-definition':'Revisa a remoção do rascunho, preservando o conhecimento já registrado.',confirm,cancel},
 contentAction:{prepare,restore,duplicate,confirm,cancel,'block-add':'Acrescenta um bloco ao formulário. Salve o rascunho para guardá-lo.','block-duplicate':'Copia esta linha no formulário; salve para guardar a nova linha.','block-remove':'Remove do formulário. Salve para guardar; a revisão publicada permanece igual.'},
 documentAction:{'new-certificate':'Abre um documento individual em branco; ainda não emite nem libera o PDF.','edit-certificate':'Edita o rascunho; um PDF já emitido não é alterado.','new-reward':'Abre um plano de recompensa. Planejar não entrega o prêmio.','edit-reward':'Altera o planejamento; não concede nem retira prêmios já registrados.',issue:'Revisa a emissão de um PDF privado. Liberar ao titular é outra ação.',grant:'Revisa a entrega real do prêmio aos beneficiários; não é apenas um rascunho.',release:'Revisa a liberação do PDF emitido ao titular.',withdraw:'Revisa a retirada da consulta ao PDF, preservando o documento emitido.',confirm,dismiss:cancel,cancel:'Fecha o editor. Edições não salvas não serão guardadas.'},
 mailAction:{send:'Revisa o envio do rascunho salvo à fila do Mestre. A entrega ao destinatário ainda é manual.',preview:'Mostra a carta salva, sem enviá-la ou entregá-la.',history:'Consulta as versões salvas pelo autor; não altera a carta.',duplicate:'Cria uma cópia como rascunho para editar e enviar separadamente.',archive:'Retira a carta da sua caixa; não apaga a cópia de outros destinatários.',confirm,dismiss:cancel},
 chocolateAction:{confirm,dismiss:cancel},
 calendarAction:{publish:'Revisa a publicação do ano e da data narrativa que você salvou.',confirm:'Publica a data preparada. O relógio real não avança a campanha automaticamente.'},
 cupAction:{start:'Revisa a abertura da competição do ano escolhido, sem pontos ou vencedor automáticos.',confirm,dismiss:cancel},
 commerceAction:{'ask-cancel':'Revisa o cancelamento de um pedido ainda pendente.',confirm:'Confirma a operação revisada. Aprovar uma compra debita o valor final e registra a entrega.',dismiss:cancel},
 boardAction:{approve:'Revisa a criação de um aviso em rascunho a partir da proposta; não o publica.',edit:'Abre a proposta para revisão, sem aprovar ou publicar.',confirm,dismiss:cancel},
 collectionAction:{approve:'Revisa a criação de uma curiosidade em rascunho. Não publica nem revela ao aluno.',confirm:'Aprova a criação como rascunho privado; publicar e descobrir continuam separados.'},
 caseAction:{history:'Consulta autoria e moderação do caso, sem modificar contribuições.'},
 action:{'toggle-region':'Altera a abertura da região para o público salvo. Salve os ajustes antes de usar.','toggle-account':'Suspende ou reativa o acesso da conta; suspender encerra suas sessões.','revoke-invite':'Invalida este convite. Não exclui uma conta que já tenha sido ativada.'}
};
const formActions={
 npcForm:{profile:save,fragment:'Guarda esta informação no rascunho do NPC, sem revelá-la.',preview},
 itemForm:{item:save,preview},
 workshopForm:{media:save,'media-quick':'Cria um registro privado para editar; não publica a imagem.',preview,cohort:'Salva a turma e seus integrantes; mudanças afetam acessos que usam esta turma.'},
 campaignForm:{profile:save,definition:'Salva o objetivo ou pista em preparação, sem atualizar os participantes.',entry:'Salva esta entrada em preparação; o protagonista só a recebe após revelação.',preview,'objective-state':'Revisa a mudança deste objetivo para os personagens marcados.', 'outcome':'Revisa o encerramento ou a reabertura. Recompensas e certificados não são concedidos por esta ação.'},
 contentForm:{quick:'Cria um rascunho privado. Complete os detalhes antes de publicar.',editor:save,preview},
 documentForm:{certificate:'Salva o texto do certificado; ainda não emite nem libera o PDF.',reward:'Guarda o plano, sem entregar itens, moedas ou descobertas.',share:'Autoriza os personagens marcados a consultar e baixar este certificado.'},
 mailForm:{compose:'Guarda a carta como rascunho do autor. Enviar e entregar são ações separadas.',image:'Guarda uma imagem privada na carta; não envia a correspondência.',moderate:'Revisa a decisão escolhida. Entregar libera a carta aos destinatários; reter mantém na fila.'},
 archiveForm:{prepare:'Analisa o arquivo e mostra o que aconteceria, sem aplicar alterações à campanha.',apply:'Executa o plano revisado e guarda antes uma cópia de segurança. Confira se escolheu importar ou restaurar.'},
 cupForm:{points:'Revisa a soma ou a retirada de pontos da Casa. O total muda somente ao confirmar.',close:'Revisa o encerramento e a publicação da Casa escolhida como vencedora.',reopen:'Revisa a reabertura para correção, preservando resultados e lançamentos anteriores.'},
 chocolateForm:{grant:'Revisa a concessão dos pacotes aos personagens marcados. O sorteio acontece ao abrir.',trade:'Revisa a troca de duas cópias físicas; o conhecimento no álbum é preservado.',cancel:'Revisa a retirada de um pacote ainda lacrado, sem apagar cartas já descobertas.'},
 commerceForm:{adjust:'Revisa um crédito ou débito manual na carteira; só será lançado após confirmar.',approve:'Revisa o preço final da compra. Confirmar debita a carteira, consome o estoque e registra a entrega.',reject:'Revisa a recusa do pedido, sem cobrar ou entregar o item.'},
 boardForm:{reject:'Revisa a recusa da proposta, preservando o registro de moderação.'},
 collectionForm:{reject:'Recusa a proposta e registra o motivo; não cria nem publica uma curiosidade.'},
 caseForm:{moderate:'Salva o estado do caso e o aviso privado. Arquivado deixa as contribuições somente para leitura.'},
 form:{invite:'Gera um link pessoal de uso único; a conta só é criada quando a pessoa aceita o convite.',region:'Aplica a abertura e o público da região; pode mudar imediatamente o acesso dos alunos.',location:'Aplica a visibilidade, os destinatários e o marcador deste local.', 'new-location':'Cadastra um local reservado para configurar; não o libera automaticamente.',group:'Salva o grupo e seus integrantes; mudanças afetam os acessos concedidos pelo grupo.',character:'Atualiza nome, Casa e ano escolar da ficha do personagem.'}
};
function contentCaption(button,state){
 const kind=state.page.match(/\/conteudos\/([^/]+)/)?.[1];
 if(button.dataset.contentAction==='ask-publish'){
  if(['chocolatecards','bestiary','rarities','memories','curiosities'].includes(kind))return 'Revisa a publicação do registro; ele só aparece no acervo de quem receber a descoberta.';
  if(['books','lessons'].includes(kind))return 'Revisa a publicação da obra ou aula. As páginas continuam dependendo de liberação própria.';
  if(kind==='regions')return 'Revisa a publicação do cadastro. A abertura da região continua sendo uma ação separada.';
  if(kind==='places')return 'Revisa a publicação do local. Acesso ainda depende da região e das permissões do lugar.';
  if(kind==='offers')return 'Revisa a exposição da oferta autorizada; preço e aprovação final continuam privados do Mestre.';
  if(kind==='chocolatepools')return 'Revisa a configuração de sorteio; não concede pacotes ou cartas.';
  if(kind==='templates')return 'Revisa a liberação do modelo nos seletores; não publica os conteúdos que usam esse modelo.';
  if(kind==='retrospectives')return 'Revisa a liberação da retrospectiva somente para seu titular.';
  if(kind==='years')return 'Revisa a publicação do cadastro deste ano; não muda o ano atual da campanha.';
  return 'Abre a confirmação para disponibilizar a revisão salva ao público permitido.';
 }
 if(button.dataset.contentAction==='ask-archive'){
  if(['books','lessons','chocolatecards','bestiary','rarities','memories','curiosities'].includes(kind))return 'Guarda o cadastro no arquivo sem apagar o que já foi publicado ou descoberto. Não revoga liberações.';
  if(kind==='regions')return 'Arquiva o cadastro e fecha a região, sem apagar locais ou histórico.';
  if(kind==='places')return 'Arquiva e desativa o local, preservando seu cadastro e histórico.';
  return 'Revisa a retirada deste cadastro de circulação, sem apagar seu histórico.';
 }
 return null;
}
function description(button,state){
 const d=button.dataset;
 if(d.contentAction){const text=contentCaption(button,state);if(text)return text;}
 if(d.caseAction==='hide')return button.textContent.includes('Restaurar')?'Torna esta contribuição visível novamente aos participantes.':'Oculta esta contribuição por moderação, sem apagar o registro.';
 for(const [attribute,map] of Object.entries(actions))if(d[attribute]&&map[d[attribute]])return map[d[attribute]];
 if(button.hasAttribute('data-quick-advanced')||button.hasAttribute('data-media-advanced')||button.hasAttribute('data-mail-advanced'))return 'Abre mais campos opcionais e preserva o que você já digitou. Não publica nem envia.';
 if(button.matches('a[download]'))return button.getAttribute('href')?.includes('/backup')?'Baixa uma cópia cifrada da campanha para recuperação. Guarde o arquivo em privado.':'Baixa o arquivo indicado; não modifica a campanha.';
 if(button.type!=='submit'||!button.form)return null;
 const f=button.form.dataset,value=button.value;
 if(f.quickCreate)return 'Cria um rascunho privado para editar, sem publicar ou revelar aos jogadores.';
 if('calendarForm' in f)return 'Salva o ano e a data preparados; a data publicada só muda ao confirmar a publicação.';
 if(f.npcForm==='reveal')return value==='revoke'?'Retira esta informação da leitura dos personagens marcados, preservando o histórico.':'Revela o texto publicado desta informação aos personagens marcados.';
 if(f.campaignForm==='participants')return ({release:'Revisa a inclusão no Diário dos selecionados; não inicia a missão.',start:'Revisa o início da missão para os selecionados; não conclui objetivos ou entrega prêmios.',revoke:'Revisa a retirada de acesso dos selecionados; preserva o histórico da jornada.'})[value];
 if(f.campaignForm==='clue-reveal')return value==='revoke-clue'?'Revisa a retirada desta pista da consulta dos personagens marcados.':'Revisa a revelação da pista publicada aos personagens marcados; não concede prêmios.';
 if(f.contentForm==='operation')return ({'reveal-pages':'Revisa a liberação das páginas ou camadas escolhidas aos destinatários marcados.','revoke-pages':'Revisa a retirada dessas páginas ou camadas; não apaga o conteúdo.',discover:'Revisa a descoberta para os selecionados; não concede posse física, moedas ou habilidades.','withdraw-discovery':'Revisa a retirada de acesso ao registro, preservando o histórico da descoberta.'})[value];
 for(const [attribute,map] of Object.entries(formActions))if(f[attribute]&&map[f[attribute]])return map[f[attribute]];
 return null;
}
export function attachActionCaptions(root,state){
 let nextId=0;
 function enhance(){
  if(state.session?.role!=='MASTER'||state.view||!state.page.startsWith('/portal/'))return;
  for(const button of root.querySelectorAll('button:not([data-action-explained]),a[download]:not([data-action-explained])')){
   const text=description(button,state);if(!text)continue;
   button.dataset.actionExplained='true';
   const wrapper=document.createElement('div');wrapper.className='action-with-caption';
   const caption=document.createElement('p');caption.className='action-caption';caption.id='action-caption-'+(++nextId);caption.textContent=text;
   button.setAttribute('aria-describedby',[button.getAttribute('aria-describedby'),caption.id].filter(Boolean).join(' '));
   const hadFocus=document.activeElement===button;
   button.before(wrapper);wrapper.append(button,caption);
   if(hadFocus)button.focus({preventScroll:true});
  }
 }
 // Some editors insert their confirmation controls without a complete render.
 new window.MutationObserver(enhance).observe(root,{childList:true,subtree:true});
 enhance();
}
