import {creationFamilies} from '/creations.js';
import {compactPolicyFields} from '/quick-create.js';
import { readPolicy } from '/editorial-ui.js';
const categoryNames={SCENERY:'Cenários',CREST:'Brasões',OBJECT:'Objetos',DOCUMENT:'Documentos',OTHER:'Outras imagens'};
const presentationNames={SCENE:'Paisagem',PORTRAIT:'Retrato',COVER:'Capa',CARD:'Cartão'};
const statusNames={DRAFT:'Rascunho',PREPARED:'Preparado',PUBLISHED:'Publicado',ARCHIVED:'Arquivado'};
const actionNames={CREATED:'Criação',SAVED:'Rascunho salvo',PREPARE:'Preparado',PUBLISH:'Publicado',DUPLICATED:'Cópia criada',ARCHIVE:'Arquivado',RESTORE:'Restaurado'};
const base='/portal/mestre/oficinas';
const defaults=()=>({audience:'SELECTED',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null});

const officeGroups=['Narrativa','Mundo/NPCs','Hogwarts/Ensino','Comércio','Acervos/Coleções','Publicações','Sistema'];
const officeEntries=[
 ['quests','Missões e Histórias','Narrativa','missoes','Autoria, participantes e capítulos','Missões'],
 ['stories','Histórias individuais','Narrativa','historias','Protagonistas e revelações privadas'],
 ['investigations','Investigações','Narrativa','/portal/mestre/investigacoes','Moderar contribuições'],
 ['npcs','NPCs','Mundo/NPCs','npcs','Pessoas, vínculos e informações'],
 ['regions','Regiões','Mundo/NPCs','conteudos/regions','Mapas e acesso às regiões'],
 ['places','Locais e marcadores','Mundo/NPCs','conteudos/places','Lugares e marcadores autorizados'],
 ['books','Livros e Biblioteca','Hogwarts/Ensino','conteudos/books','Acervo escolar e páginas','Livros'],
 ['lessons','Aulas','Hogwarts/Ensino','conteudos/lessons','Conteúdos de ensino'],
 ['years','Anos letivos','Hogwarts/Ensino','conteudos/years','Anos e arquivos da campanha'],
 ['events','Eventos','Hogwarts/Ensino','conteudos/events','Eventos e modelos informativos'],
 ['timetables','Grades','Hogwarts/Ensino','conteudos/timetables','Programação das aulas'],
 ['calendar','Data da campanha','Hogwarts/Ensino','/portal/mestre/calendario','Preparar a data narrativa'],
 ['cup','Pontos das Casas','Hogwarts/Ensino','/portal/mestre/taca','Taça e lançamentos manuais'],
 ['items','Itens','Comércio','itens','Objetos, propriedades e efeitos'],
 ['shops','Lojas','Comércio','conteudos/shops','Estabelecimentos e catálogos'],
 ['offers','Ofertas','Comércio','conteudos/offers','Vínculos, preços e disponibilidade'],
 ['chocolatecards','Sapos de Chocolate','Acervos/Coleções','conteudos/chocolatecards','Cartas e descobertas'],
 ['chocolatepools','Pools de Sapos','Acervos/Coleções','conteudos/chocolatepools','Configurar probabilidades'],
 ['chocolate','Pacotes e trocas de Sapos','Acervos/Coleções','/portal/mestre/sapos','Operações manuais de posse'],
 ['bestiary','Bestiário Encantado','Acervos/Coleções','conteudos/bestiary','Espécies e encontros'],
 ['rarities','Biblioteca de Raridades','Acervos/Coleções','conteudos/rarities','Obras extraordinárias'],
 ['memories','Recordações','Acervos/Coleções','conteudos/memories','Memórias e registros individuais'],
 ['curiosities','Gabinete de Curiosidades','Acervos/Coleções','conteudos/curiosities','Achados e criações'],
 ['curiosityproposals','Propostas de curiosidades','Acervos/Coleções','/portal/mestre/curiosidades','Moderar propostas dos alunos'],
 ['newspapers','Profeta Diário','Publicações','conteudos/newspapers','Edições e artigos','Notícias'],
 ['boards','Murais','Publicações','conteudos/boards','Quadros e destinatários'],
 ['notices','Avisos','Publicações','conteudos/notices','Autoria dos avisos'],
 ['boardproposals','Moderação de murais','Publicações','/portal/mestre/murais','Revisar propostas de avisos'],
 ['yearbooks','Anuários públicos','Publicações','conteudos/yearbooks','Memórias do ano letivo'],
 ['retrospectives','Retrospectivas individuais','Publicações','conteudos/retrospectives','Registros exclusivos do titular'],
 ['mail','Correspondências','Publicações','/portal/correio','Escrever e guardar cartas'],
 ['mailqueue','Fila do Correio','Publicações','/portal/mestre/correio','Revisar e entregar correspondências'],
 ['media','Biblioteca de Mídia','Sistema','midias','Imagens, capas e apresentações'],
 ['templates','Modelos e ornamentos','Sistema','conteudos/templates','Composições e textos reutilizáveis'],
 ['archives','Exportação e recuperação','Sistema','/portal/mestre/arquivos','Pacotes de autoria e backups cifrados']
].filter(([id])=>!['stories','years','events','timetables','calendar','offers','chocolatepools','templates','archives','yearbooks','retrospectives'].includes(id)).map(([id,title,group,path,description,favorite])=>({id,title,group,path:path.startsWith('/')?path:base+'/'+path,description,favorite:favorite??title}));
const defaultFavorites=['quests','items','npcs','books','newspapers'];
const normalizeOffice=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function createWorkshop({api,esc,ico,label,empty,button,state,render,navigate,toast}){
  let context=null,current=null,history=[],list=null,preview=null,error=null;
  let officeRecords=null,officeRecordsError='',officeSearchPending=false;
  let officeQuery='',officeMode='cards',favorites=[...defaultFavorites];
  try{const prefs=JSON.parse(window.localStorage.getItem('hogwarts-office-v5')??'null');if(prefs){officeMode=prefs.mode==='list'?'list':'cards';if(Array.isArray(prefs.favorites))favorites=[...new Set(prefs.favorites.filter(id=>officeEntries.some(e=>e.id===id)))];}}catch{/* Preferences are optional; no campaign data is stored here. */}
  const saveOfficePreferences=()=>{try{window.localStorage.setItem('hogwarts-office-v5',JSON.stringify({mode:officeMode,favorites}));}catch{/* Continue with this session's preferences. */}};
  let filters={q:'',status:'',category:'',year:'',page:1};
  const admin=()=>state.session?.role==='MASTER'&&!state.view;
  const handles=path=>path.startsWith(base)||path==='/portal/midias';
  const queryString=()=>new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==''));
  const select=(name,title,options,value='',extra='')=>`<div class="field"><label for="ws-${name}">${title}</label><select id="ws-${name}" name="${name}" ${extra}>${options.map(([id,text])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(text)}</option>`).join('')}</select></div>`;
  const field=(name,title,value='',extra='')=>`<div class="field"><label for="ws-${name}">${title}</label><input id="ws-${name}" name="${name}" value="${esc(value)}" ${extra}></div>`;
  const formError='<p class="form-error" role="alert" tabindex="-1"></p>';
  async function load(){
    error=null;preview=null;
    if(!handles(state.page))return;
    if(state.page!== '/portal/midias'&&!admin()){error='Acesso reservado ao Mestre.';return;}
    try{
      if(admin())context=await api('/api/master/workshop/context',{preview:false});
      if(state.page==='/portal/midias'){const [years,media]=await Promise.all([api('/api/calendar/years'),api(`/api/workshop/media?${queryString()}`)]);context={academicYears:years.items};list=media;}
      else if(state.page===`${base}/midias`)list=await api(`/api/master/workshop/media?${queryString()}`,{preview:false});
      else if(state.page.startsWith(`${base}/midias/`)){
        const id=state.page.split('/').pop();
        if(id==='nova'){current=null;history=[];}
        else{
          const result=await Promise.all([api(`/api/master/workshop/media/${id}`,{preview:false}),api(`/api/master/workshop/media/${id}/history`,{preview:false})]);
          current=result[0];history=result[1].items;
        }
      }
    }catch(e){error=e.message;}
  }
  function filterForm(isAdmin){
    return `<form class="workshop-filters" data-workshop-form="filters">${field('q','Buscar imagem',filters.q,'type="search" maxlength="120"')}${select('category','Categoria',[['','Todas'],...Object.entries(categoryNames)],filters.category)}${isAdmin?select('status','Estado',[['','Todos'],...Object.entries(statusNames)],filters.status):''}<input type="hidden" name="year" value=""><button class="btn ghost" type="submit">Buscar</button></form>`;
  }
  function cards(isAdmin){
    if(!list?.items.length)return empty(isAdmin?'Sua biblioteca ainda não tem imagens neste filtro.':'Nenhuma imagem liberada por enquanto.');
    return `<div class="media-grid">${list.items.map(item=>`<article class="card media-record">${isAdmin?`<a href="${base}/midias/${esc(item.id)}" data-go="${base}/midias/${esc(item.id)}">`:''}<img loading="lazy" src="${esc(item.image)}${!isAdmin&&state.view?'&view_as='+encodeURIComponent(state.view):''}" alt="${esc(item.alt??'')}"><div class="media-record-body">${isAdmin?`<span class="badge">${statusNames[item.status]}</span>`:''}<h2>${esc(item.title)}</h2><p class="subtle">${categoryNames[item.category]}</p>${isAdmin&&item.hasUnpublishedChanges?'<p class="draft-warning">Há alterações não publicadas.</p>':''}${!isAdmin?`<p>${esc(item.description)}</p>${item.credit?`<small class="muted">${esc(item.credit)}</small>`:''}`:''}</div>${isAdmin?'</a>':''}</article>`).join('')}</div>`;
  }
  function pagination(){
    if(!list||list.total<=list.pageSize)return '';
    return `<nav class="workshop-pagination" aria-label="Páginas da biblioteca"><button class="btn ghost" data-workshop-action="previous" ${list.page<=1?'disabled':''}>Anterior</button><span>Página ${list.page} · ${list.total} imagens</span><button class="btn ghost" data-workshop-action="next" ${list.page*list.pageSize>=list.total?'disabled':''}>Próxima</button></nav>`;
  }
  function officeEntry(entry,favorite=false){return `<article class="office-shortcut"><a class="office-link" href="${esc(entry.path)}" data-go="${esc(entry.path)}"><strong>${esc(favorite?entry.favorite:entry.title)}</strong><small>${esc(entry.description)}</small></a><button class="office-star" type="button" data-office-star="${entry.id}" aria-pressed="${favorites.includes(entry.id)}" aria-label="${favorites.includes(entry.id)?'Remover':'Adicionar'} ${esc(entry.favorite)} ${favorites.includes(entry.id)?'dos':'aos'} favoritos">${ico('star',18)}</button></article>`;}
  function officeRecordResults(){
    if(!officeQuery)return '';
    if(officeSearchPending)return '<p role="status">Buscando criações salvas…</p>';
    if(officeRecordsError)return `<section class="card note-panel office-record-results" role="alert"><h2 class="head3">Criações salvas indisponíveis</h2><p>${esc(officeRecordsError)}</p>${button('Abrir Minhas Criações','/portal/mestre/criacoes')}</section>`;
    if(!officeRecords)return '';
    const href='/portal/mestre/criacoes?q='+encodeURIComponent(officeQuery);
    return `<section class="office-record-results"><h2 class="head3">Criações salvas</h2><p class="subtle">${Math.min(6,officeRecords.items.length)} de ${officeRecords.total} registros encontrados. Os resultados abaixo retomam os editores existentes.</p>${officeRecords.items.length?`<div class="office-record-grid">${officeRecords.items.slice(0,6).map(r=>`<article class="card note-panel"><p class="eyebrow">${esc(creationFamilies[r.kind]??r.kind)}</p><h3 class="head3">${esc(r.title)}</h3>${r.hasUnpublishedChanges?'<p class="draft-warning">Há mudanças não publicadas.</p>':''}<a class="btn ghost" href="${esc(r.editorHref)}" data-go="${esc(r.editorHref)}">Continuar editando</a></article>`).join('')}</div>`:'<p class="muted">Nenhum registro com esse nome. As ferramentas correspondentes continuam abaixo.</p>'}<a class="btn ghost" href="${esc(href)}">Ver todas as criações encontradas</a></section>`;
  }
  function office(){
    const query=normalizeOffice(officeQuery.trim()),matches=officeEntries.filter(e=>normalizeOffice([e.title,e.favorite,e.description,e.group].join(' ')).includes(query));
    return `${label('ADMINISTRAÇÃO')}<div class="workshop-title"><div><h1 class="display">Oficina Geral do Mestre</h1><p>${button('Minhas Criações','/portal/mestre/criacoes','quill')}</p><p class="muted">Crie rascunhos privados e complete os detalhes quando precisar.</p></div>${button('Central da Sessão','/portal/mestre','shield')}</div><form class="workshop-filters" data-workshop-form="office-search">${field('officeQuery','Buscar oficina ou criação',officeQuery,'type="search" aria-label="Buscar oficina" maxlength="100"')}<button class="btn ghost" type="submit">Buscar oficinas</button></form>${officeRecordResults()}<div class="group" role="group" aria-label="Visualização das oficinas">${[['cards','Cartões compactos'],['list','Lista']].map(([mode,title])=>`<button class="btn ghost" type="button" data-office-mode="${mode}" aria-pressed="${officeMode===mode}">${title}</button>`).join('')}</div><div id="office-results" class="office-directory mode-${officeMode}">${query?`<section><h2 class="head3" tabindex="-1">Resultados da busca</h2>${matches.length?`<div class="office-links">${matches.map(e=>officeEntry(e)).join('')}</div>`:empty('Nenhuma oficina neste filtro.')}</section>`:`<section class="office-favorites" aria-label="Favoritos"><h2 class="head3">Favoritos</h2><div class="office-links">${favorites.length?favorites.filter(id=>officeEntries.some(e=>e.id===id)).map(id=>officeEntry(officeEntries.find(e=>e.id===id),true)).join(''):empty('Abra uma área e marque as oficinas que você usa mais.')}</div></section><h2 class="head3">Áreas da oficina</h2>${officeGroups.map(group=>`<details class="office-area"><summary>${esc(group)}</summary><div class="office-links">${officeEntries.filter(e=>e.group===group).map(e=>officeEntry(e)).join('')}</div></details>`).join('')}`}</div><details class="advanced-fields office-cohorts"><summary>Turmas e destinatários</summary><section class="card workshop-cohorts"><h2 class="head3">Turmas e destinatários</h2><p class="subtle">Organize turmas para restringir a consulta às imagens, aos NPCs e aos itens. Grupos e personagens continuam na Central da Sessão.</p><div class="dual">${[...context.cohorts,{id:'',name:'',members:[]}].map((c,index)=>`<form data-workshop-form="cohort" data-id="${esc(c.id)}" data-version="${c.version??''}"><label class="field">${c.id?'Nome da turma':'Nova turma'}<input name="name" aria-label="${c.id?'Nome da turma':'Nova turma'}" value="${esc(c.name)}" maxlength="80" required></label><fieldset class="recipient-field"><legend>Integrantes ${index+1}</legend><div class="checks">${context.characters.map(character=>`<label><input type="checkbox" name="members" value="${esc(character.id)}" ${c.members.includes(character.id)?'checked':''}>${esc(character.name)}</label>`).join('')}</div></fieldset>${formError}<button class="btn ghost" type="submit">${c.id?'Salvar turma':'Criar turma'}</button></form>`).join('')}</div></section></details>`;
  }
  function policyEditor(p){return compactPolicyFields(context,p,esc,'media-access');}
  function policyDescription(p){
    const names=(ids,rows,key='name')=>ids.map(id=>rows.find(row=>row.id===id)?.[key]??'Registro removido').join(', ');
    return [p.audience==='ALL'?'Todos autorizados':'Seleção: '+[names(p.characters,context.characters),names(p.groups,context.groups)].filter(Boolean).join('; '),
      p.houses.length?'Casas: '+names(p.houses,context.houses):'',p.schoolYears.length?'Anos: '+p.schoolYears.join(', '):'',
      p.cohorts.length?'Turmas: '+names(p.cohorts,context.cohorts):'',p.excludedCharacters.length?'Exceções: '+names(p.excludedCharacters,context.characters):'',
      p.regionId?'Região: '+names([p.regionId],context.regions,'title'):'',p.locationId?'Local: '+names([p.locationId],context.locations,'title'):''].filter(Boolean).join(' · ');
  }
  function quickMedia(){return `${label('OFICINA GERAL','Biblioteca de Mídia')}<div class="workshop-title"><h1 class="display">Nova imagem</h1>${button('Biblioteca de Mídia',base+'/midias','book')}</div><section class="card quick-create"><p class="muted">Envie uma imagem uma vez e reutilize o arquivo. O registro começa como rascunho privado.</p><form data-workshop-form="media-quick">${field('title','Nome (opcional)','','maxlength="120" placeholder="Usar nome do arquivo"')}<label class="field">Enviar uma imagem<input name="upload" type="file" accept="image/jpeg,image/png,image/webp"></label><details class="advanced-fields"><summary>Reutilizar imagem existente</summary>${select('asset','Ou selecionar uma imagem aprovada',[['','Escolher imagem aprovada'],...context.approvedAssets.map(a=>[a,a.replaceAll('_',' ').replace('.webp','')])])}${select('fileId','Ou reutilizar um arquivo da biblioteca',[['','Escolher arquivo'],...context.files.map((f,i)=>[f.id,'Imagem '+(i+1)+' · '+f.width+' × '+f.height])])}<p class="subtle">Arquivos de ambientação já são públicos. A restrição deste registro não torna o original secreto.</p></details>${select('visibility','Uso do registro',[['MASTER','Privado do Mestre'],['REVIEW','Compartilhável após revisão']])}<p class="subtle">Salvar não publica. Destinatários, corte e texto alternativo podem ser ajustados na edição.</p>${formError}<button class="btn" type="submit">Criar rascunho</button></form><button class="btn ghost small" type="button" data-media-advanced>Usar criação avançada</button></section>`;}
  function editor(){
    if(!current&&!state.fullCreate)return quickMedia();
    const c=current,payload=c?.payload??{title:'',description:'',alt:'',category:'SCENERY',credit:'',academicYear:context.currentAcademicYear??'1890–1891',fileId:'',presentation:'SCENE',crop:{x:0,y:0,width:100,height:100}},archived=c?.status==='ARCHIVED';
    return `${label('OFICINA GERAL','Biblioteca de Mídia')}<div class="workshop-title"><div><h1 class="display">${c?'Editar imagem':'Nova imagem'}</h1>${c?`<span class="badge">${statusNames[c.status]} · revisão ${c.version}</span>${c.hasUnpublishedChanges?'<p class="draft-warning">Alterações salvas ainda não publicadas.</p>':''}`:''}</div>${button('Biblioteca de Mídia',`${base}/midias`,'book')}</div><div class="workshop-editor"><div><form class="card media-editor-form" data-workshop-form="media"><fieldset ${archived?'disabled':''} class="editor-fields"><legend class="sr-only">Dados da imagem</legend>${field('title','Nome',payload.title,'required maxlength="120"')}<div class="field"><label for="ws-description">Descrição visível</label><textarea id="ws-description" name="description" rows="3" maxlength="3000">${esc(payload.description)}</textarea></div><div class="dual">${select('category','Categoria',Object.entries(categoryNames),payload.category)}${select('academicYear','Ano letivo',context.academicYears.map(y=>[y.id,y.name]),payload.academicYear)}</div><fieldset class="source-fields"><legend>Escolha a imagem</legend><div class="field"><label for="ws-upload">Enviar uma imagem</label><input id="ws-upload" name="upload" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG ou WebP · até 2 MB.</small></div>${select('asset','Ou selecionar uma imagem aprovada',[['','Escolher imagem aprovada'],...context.approvedAssets.map(a=>[a,a.replaceAll('_',' ').replace('.webp','')])])}${select('fileId','Ou reutilizar um arquivo da biblioteca',[['','Escolher arquivo'],...context.files.map((f,index)=>[f.id,`Imagem ${index+1} · ${f.width} × ${f.height}`])],payload.fileId)}<img id="source-preview" class="source-preview" src="${esc(c?.file?.image??'/assets/hogwarts.webp')}" alt="Imagem escolhida para edição"><p id="source-note" class="subtle">${c?.file?.originalAlreadyPublic?'Esta arte de ambientação já é pública na ambientação do portal. Restringir este registro não torna o arquivo original secreto.':''}</p></fieldset>${field('alt','Texto alternativo',payload.alt,'maxlength="300" placeholder="'+esc(payload.title)+'"')}<details class="advanced-fields"><summary>Corte, apresentação e notas</summary>${select('presentation','Apresentação',Object.entries(presentationNames),payload.presentation)}<div class="crop-fields">${[['cropX','Início horizontal (%)','x',0],['cropY','Início vertical (%)','y',0],['cropWidth','Largura (%)','width',0.1],['cropHeight','Altura (%)','height',0.1]].map(([name,title,key,min])=>field(name,title,payload.crop[key],`type="number" min="${min}" max="100" step="0.1" required`)).join('')}</div><p class="subtle">Salve o rascunho para conferir o corte na prévia. Nome e texto alternativo são necessários para publicar.</p>${field('credit','Crédito ou origem visível',payload.credit,'maxlength="300"')}<div class="field"><label for="ws-privateNotes">Notas privadas do Mestre</label><textarea id="ws-privateNotes" name="privateNotes" rows="3" maxlength="5000">${esc(c?.privateNotes??'')}</textarea></div></details>${policyEditor(c?.policy??defaults())}${formError}<button class="btn" type="submit">${c?'Salvar rascunho':'Criar rascunho'}</button></fieldset></form></div><aside class="editor-sidebar">${c?`<section class="card editor-actions"><h2 class="head3">Ações do registro</h2><p class="subtle">Publicar libera a revisão salva para seus destinatários. Arquivar retira esta imagem da biblioteca dos jogadores e preserva seu histórico.</p><div class="editor-action-buttons">${!archived?`<button class="btn ghost" data-workshop-action="prepare" ${c.status==='PUBLISHED'?'disabled':''}>Preparar</button><button class="btn" data-workshop-action="ask-publish">Revisar publicação</button><button class="btn ghost" data-workshop-action="ask-archive">Arquivar</button>`:`<button class="btn" data-workshop-action="restore">Restaurar sem publicar</button>`}<button class="btn ghost" data-workshop-action="duplicate">Duplicar como rascunho</button></div><div id="workshop-confirm" aria-live="polite"></div></section><section class="card editor-preview"><h2 class="head3">Prévia como personagem</h2><form data-workshop-form="preview">${select('previewCharacter','Personagem da prévia',context.characters.map(ch=>[ch.id,ch.name]))}${select('previewSource','Revisão da prévia',[['draft','Rascunho salvo'],...(c.publishedRevision?[['published','Revisão publicada']]:[])])}${formError}<button class="btn ghost" type="submit">Conferir acesso e aparência</button></form><div id="workshop-preview-result">${empty('Escolha um personagem para conferir sua visão.')}</div></section><section class="card editor-history"><h2 class="head3">Histórico de alterações</h2><p class="subtle">Revisões preservadas · somente Mestre.</p>${history.map(h=>`<details><summary>Revisão ${h.version} · ${actionNames[h.action]??esc(h.action)}</summary><time>${new Date(h.createdAt*1000).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</time><dl><dt>Autor</dt><dd>${esc(context.authors.find(a=>a.id===h.actorId)?.email??'Mestre')}</dd><dt>Nome</dt><dd>${esc(h.snapshot.payload.title)}</dd><dt>Estado</dt><dd>${statusNames[h.snapshot.status]}</dd><dt>Descrição</dt><dd>${esc(h.snapshot.payload.description||'—')}</dd><dt>Texto alternativo</dt><dd>${esc(h.snapshot.payload.alt||'—')}</dd><dt>Crédito</dt><dd>${esc(h.snapshot.payload.credit||'—')}</dd><dt>Corte</dt><dd>${h.snapshot.payload.crop.x}%, ${h.snapshot.payload.crop.y}% · ${h.snapshot.payload.crop.width}% × ${h.snapshot.payload.crop.height}%</dd><dt>Público e restrições</dt><dd>${esc(policyDescription(h.snapshot.policy))}</dd><dt>Notas privadas</dt><dd>${esc(h.snapshot.privateNotes||'—')}</dd></dl></details>`).join('')}</section>`:empty('Salve o primeiro rascunho para preparar, publicar e conferir as revisões.')}</aside></div>`;
  }
  function page(){
    if(error)return `${label('OFICINA GERAL')}${empty(error)}${button('Voltar ao início','/portal/inicio')}`;
    if(state.page===base)return office();
    if(state.page===`${base}/midias`||state.page==='/portal/midias'){
      const isAdmin=state.page!== '/portal/midias';
      return `${label(isAdmin?'OFICINA GERAL':'ARQUIVOS LIBERADOS')}<div class="workshop-title"><div><h1 class="display">${isAdmin?'Biblioteca de Mídia':'Galeria de Imagens'}</h1><p class="muted">${isAdmin?'Organize sua arte e libere apenas o que deseja revelar.':'Imagens compartilhadas com você.'}</p></div>${isAdmin?button('Nova imagem',`${base}/midias/nova`,'star'):''}</div>${filterForm(isAdmin)}${cards(isAdmin)}${pagination()}`;
    }
    return editor();
  }
  function previewMarkup(value){
    if(!value.accessible)return empty('Esta revisão não está disponível para o personagem selecionado.');
    const m=value.media;return `<article class="media-record preview-${m.presentation.toLowerCase()}"><img src="${esc(m.image)}" alt="${esc(m.alt)}"><div class="media-record-body"><h3 class="head3">${esc(m.title)}</h3><p>${esc(m.description)}</p><small class="muted">${esc(m.credit)}</small></div></article><p class="subtle">Somente leitura. A prévia não publica nem registra leitura.</p>`;
  }
  async function submit(form,unified=false){
    if(state.busy)return;state.busy=true;
    const submit=form.querySelector('button[type="submit"]'),errorEl=form.querySelector('.form-error'),data=new FormData(form),kind=form.dataset.workshopForm;
    if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');}if(errorEl)errorEl.textContent='';
    try{
      if(kind==='filters'){
        filters={q:String(data.get('q')??''),category:String(data.get('category')??''),status:String(data.get('status')??''),year:String(data.get('year')??''),page:1};
        state.dirty=false;await load();render();return;
      }
      if(!admin())throw new Error('Acesso reservado ao Mestre.');
      if(kind==='preview'){
        preview=await api(`/api/master/workshop/media/${current.id}/preview?character=${encodeURIComponent(data.get('previewCharacter'))}&source=${data.get('previewSource')}`,{preview:false});
        document.querySelector('#workshop-preview-result').innerHTML=previewMarkup(preview);return;
      }
      if(kind==='cohort'){
        const id=form.dataset.id;await api(`/api/master/workshop/cohorts${id?'/'+id:''}`,{method:id?'PATCH':'POST',preview:false,body:{name:data.get('name'),members:data.getAll('members'),...(id?{version:Number(form.dataset.version)}:{})}});
        state.dirty=false;await load();render();toast('Turma salva.');return;
      }
      const editingId=current?.id,editingVersion=current?.version,sourcePage=state.page;
      const upload=data.get('upload'),asset=String(data.get('asset')??'');
      let fileId=String(data.get('fileId')??'');
      if(upload?.size){
        if(upload.size>2*1024*1024)throw new Error('Escolha uma imagem de até 2 MB.');
        fileId=(await api('/api/master/workshop/files',{method:'POST',raw:true,body:upload,preview:false})).id;
      }else if(asset)fileId=(await api('/api/master/workshop/files',{method:'POST',preview:false,body:{asset}})).id;
      if(!fileId)throw new Error('Envie ou selecione uma imagem.');
      const policy=kind==='media-quick'?{...defaults(),audience:data.get('visibility')==='REVIEW'?'ALL':'SELECTED'}:readPolicy(data);
      const title=String(data.get('title')??'').trim()||(kind==='media-quick'?String(upload?.name||asset||'Imagem reutilizada').replace(/\.[^.]+$/,'').replaceAll('_',' ').slice(0,120):'');
      const payload=kind==='media-quick'?{title,description:'',alt:'',category:'SCENERY',credit:'',academicYear:context.currentAcademicYear,presentation:'SCENE',fileId,crop:{x:0,y:0,width:100,height:100}}:{title,description:data.get('description'),alt:data.get('alt'),category:data.get('category'),credit:data.get('credit'),academicYear:data.get('academicYear'),presentation:data.get('presentation'),fileId,crop:{x:Number(data.get('cropX')),y:Number(data.get('cropY')),width:Number(data.get('cropWidth')),height:Number(data.get('cropHeight'))}};
      if(state.page!==sourcePage)throw new Error('A página mudou durante o salvamento.');
      const saved=await api(`/api/master/workshop/media${editingId?'/'+editingId:''}`,{method:editingId?'PATCH':'POST',preview:false,body:{...(editingId?{version:editingVersion}:{}),payload,policy,privateNotes:data.get('privateNotes')??''}});
      if(unified){if(state.page!==sourcePage)return saved;current=saved;return saved;}
      if(state.page===sourcePage){state.dirty=false;await navigate(`${base}/midias/${saved.id}`,true);}toast('Rascunho salvo. A publicação é uma ação separada.');
    }catch(e){if(errorEl){errorEl.textContent=e.message;errorEl.focus();}else toast(e.message,true);if(unified){e.officeForm=form;throw e;}}
    finally{state.busy=false;if(submit){submit.disabled=false;submit.removeAttribute('aria-busy');}}
  }
  function attach(root){
    root.addEventListener('submit',async event=>{
      const form=event.target;if(!(form instanceof HTMLFormElement)||!form.dataset.workshopForm)return;
      if(form.dataset.workshopForm==='office-search'){event.preventDefault();if(state.dirty){toast('Salve a turma antes de mudar a busca.',true);return;}officeQuery=String(new FormData(form).get('officeQuery')??'').slice(0,100);officeRecords=null;officeRecordsError='';const requested=officeQuery;
        if(requested&&admin()){officeSearchPending=true;render();try{officeRecords=await api('/api/master/creations?status=ALL&q='+encodeURIComponent(requested));}catch(e){officeRecordsError=e.message;}finally{officeSearchPending=false;}}
        if(state.page===base&&officeQuery===requested){render();root.querySelector('#office-results h2')?.focus();}return;}
      event.preventDefault();void submit(form);
    });
    root.addEventListener('change',event=>{
      if(!['asset','fileId'].includes(event.target.name))return;
      const target=event.target,image=root.querySelector('#source-preview'),note=root.querySelector('#source-note');if(!image)return;
      if(target.name==='asset'&&target.value){image.src='/assets/'+encodeURIComponent(target.value);note.textContent='Esta arte de ambientação já é pública na ambientação do portal. A restrição vale para este registro.';}
      else if(target.name==='fileId'&&target.value){const f=context.files.find(f=>f.id===target.value);if(f){image.src=f.image;note.textContent=f.originalAlreadyPublic?'Arte V4 de ambientação já pública.':'';}}
    });
    root.addEventListener('click',async event=>{
      if(event.target.closest('[data-media-advanced]')){if(state.busy)return;const quick=root.querySelector('[data-workshop-form="media-quick"]'),values=new FormData(quick),selected=quick.querySelector('[name=upload]').files;state.fullCreate=true;render();const form=root.querySelector('[data-workshop-form="media"]');for(const name of ['title','asset','fileId'])form.querySelector('[name="'+name+'"]').value=String(values.get(name)??'');form.querySelector('[name=upload]').files=selected;const all=values.get('visibility')==='REVIEW';form.querySelector('[name=audience]').value=all?'ALL':'SELECTED';form.querySelector('[data-compact-policy] summary .subtle').textContent=all?'Todos, respeitando restrições':'Seleção específica';form.querySelector('[name=title]').focus();return;}
      const preference=event.target.closest('[data-office-mode],[data-office-star]');if(preference){event.preventDefault();if(state.dirty){toast('Salve a turma antes de mudar a visualização.',true);return;}if(preference.dataset.officeMode)officeMode=preference.dataset.officeMode==='list'?'list':'cards';else{const id=preference.dataset.officeStar;if(favorites.includes(id))favorites=favorites.filter(f=>f!==id);else if(officeEntries.some(e=>e.id===id))favorites.push(id);}saveOfficePreferences();render();root.querySelector(preference.dataset.officeMode?'[data-office-mode="'+officeMode+'"]':'#ws-officeQuery')?.focus();return;}
      const el=event.target.closest('[data-workshop-action]');if(!el)return;event.preventDefault();if(state.busy)return;
      const action=el.dataset.workshopAction;
      if(action==='ask-publish'||action==='ask-archive'){
        const confirm=root.querySelector('#workshop-confirm'),publish=action==='ask-publish';
        confirm.innerHTML=`<div class="action-confirm"><p>${publish?'Publicar a revisão salva para os destinatários definidos?':'Arquivar este registro e retirar seu acesso da galeria? O histórico será preservado.'}</p><button class="btn" data-workshop-action="${publish?'publish':'archive'}">${publish?'Confirmar publicação':'Confirmar arquivamento'}</button><button class="btn ghost" data-workshop-action="cancel">Cancelar</button></div>`;
        confirm.querySelector('button').focus();return;
      }
      if(action==='cancel'){root.querySelector('#workshop-confirm').innerHTML='';return;}
      state.busy=true;el.disabled=true;
      try{
        if(action==='next'||action==='previous'){filters.page+=action==='next'?1:-1;await load();render();return;}
        if(!admin())throw new Error('Acesso reservado ao Mestre.');
        if(state.dirty)throw new Error('Salve ou recarregue suas alterações antes desta ação.');
        const saved=await api(`/api/master/workshop/media/${current.id}/${action}`,{method:'POST',preview:false,body:{version:current.version}});
        await navigate(`${base}/midias/${saved.id}`,true);toast(action==='restore'?'Registro restaurado sem publicar. Revise e publique para liberar.':'Ação registrada.');
      }catch(e){toast(e.message,true);}finally{state.busy=false;el.disabled=false;}
    });
  }
  async function poll(){
    const path=state.page==='/portal/midias'?'/api/workshop/media':state.page===`${base}/midias`?'/api/master/workshop/media':null;
    if(!path)return;
    const next=await api(`${path}?${queryString()}`);
    if(JSON.stringify(next)!==JSON.stringify(list)){list=next;render();}
  }
  return {handles,load,page,attach,poll,savedRecord:()=>current,saveDrafts:async(_root,forms)=>{let cohorts=false;for(const form of forms){if(form.dataset.workshopForm==='cohort'){cohorts=true;try{const d=new FormData(form),id=form.dataset.id,saved=await api('/api/master/workshop/cohorts'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:{name:d.get('name'),members:d.getAll('members'),...(id?{version:Number(form.dataset.version)}:{})}});form.dataset.id=saved.id;form.dataset.version=String(saved.version);}catch(e){e.officeForm=form;form.querySelector('.form-error').textContent=e.message;throw e;}}else await submit(form,true);}return cohorts?base:base+'/midias/'+current.id;}};
}
