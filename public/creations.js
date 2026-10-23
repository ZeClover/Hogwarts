export function createCreationsOffice({api,esc,ico,label,empty,button,state,render}){
  const route='/portal/mestre/criacoes';
  const contentBase='/portal/mestre/oficinas/conteudos/';
  const sources=[
    ['quests','Missões','Narrativa','/portal/mestre/oficinas/missoes','/api/master/campaign/quests','scroll'],
    ['stories','Histórias individuais','Narrativa','/portal/mestre/oficinas/historias','/api/master/campaign/stories','quill'],
    ['npcs','NPCs','Mundo','/portal/mestre/oficinas/npcs','/api/master/workshop/npcs','user'],
    ['regions','Regiões','Mundo',contentBase+'regions','/api/master/content/regions','map'],
    ['places','Locais e marcadores','Mundo',contentBase+'places','/api/master/content/places','map'],
    ['items','Itens','Comércio','/portal/mestre/oficinas/itens','/api/master/workshop/items','star'],
    ['shops','Lojas','Comércio',contentBase+'shops','/api/master/content/shops','castle'],
    ['offers','Ofertas','Comércio',contentBase+'offers','/api/master/content/offers','star'],
    ['books','Livros e Biblioteca','Hogwarts',contentBase+'books','/api/master/content/books','book'],
    ['lessons','Aulas','Hogwarts',contentBase+'lessons','/api/master/content/lessons','book'],
    ['years','Anos letivos','Hogwarts',contentBase+'years','/api/master/content/years','clock'],
    ['events','Eventos','Hogwarts',contentBase+'events','/api/master/content/events','clock'],
    ['timetables','Grades','Hogwarts',contentBase+'timetables','/api/master/content/timetables','clock'],
    ['newspapers','Profeta Diário','Publicações',contentBase+'newspapers','/api/master/content/newspapers','scroll'],
    ['boards','Murais','Publicações',contentBase+'boards','/api/master/content/boards','scroll'],
    ['notices','Avisos','Publicações',contentBase+'notices','/api/master/content/notices','quill'],
    ['yearbooks','Anuários públicos','Publicações',contentBase+'yearbooks','/api/master/content/yearbooks','book'],
    ['retrospectives','Retrospectivas','Publicações',contentBase+'retrospectives','/api/master/content/retrospectives','book'],
    ['chocolatecards','Sapos de Chocolate','Acervos',contentBase+'chocolatecards','/api/master/content/chocolatecards','star'],
    ['chocolatepools','Pools de Sapos','Acervos',contentBase+'chocolatepools','/api/master/content/chocolatepools','star'],
    ['bestiary','Bestiário','Acervos',contentBase+'bestiary','/api/master/content/bestiary','book'],
    ['rarities','Raridades','Acervos',contentBase+'rarities','/api/master/content/rarities','book'],
    ['memories','Recordações','Acervos',contentBase+'memories','/api/master/content/memories','quill'],
    ['curiosities','Curiosidades','Acervos',contentBase+'curiosities','/api/master/content/curiosities','star'],
    ['templates','Modelos e ornamentos','Sistema',contentBase+'templates','/api/master/content/templates','star'],
    ['media','Biblioteca de Mídia','Sistema','/portal/mestre/oficinas/midias','/api/master/workshop/media','book']
  ].map(([id,title,group,path,endpoint,icon])=>({id,title,group,path,endpoint,icon}));
  const featured=['quests','npcs','items','books','lessons','newspapers'];
  const statusLabels={DRAFT:'Rascunho',PREPARED:'Preparado',PUBLISHED:'Publicado',ARCHIVED:'Arquivado'};
  let entries=[],failures=[],currentStatus='active',currentGroup='all',term='',loading=false;
  const allowed=()=>state.session?.role==='MASTER'&&!state.view;
  const handles=path=>path===route;
  function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function asRow(source,item){
    const payload=item.payload??item;
    return {id:item.id,source,name:String(payload.name??payload.title??payload.heading??payload.fileName??'Registro sem título'),status:String(item.status??'DRAFT'),pending:Boolean(item.hasUnpublishedChanges),updated:item.updatedAt??item.updated_at??item.createdAt??0};
  }
  async function collect(source){
    const all=[];let page=1;
    do{
      const qs=new URLSearchParams({page:String(page)});
      const result=await api(source.endpoint+'?'+qs,{preview:false});
      if(!Array.isArray(result?.items))throw new Error('Resposta de listagem inválida');
      all.push(...result.items.map(row=>asRow(source,row)));
      const total=Number(result.total??all.length);
      if(!result.items.length||all.length>=total)break;
      page++;
      if(page>100)throw new Error('A lista ultrapassou o limite de páginas');
    }while(true);
    return all;
  }
  async function load(){
    entries=[];failures=[];loading=true;
    if(!allowed()){loading=false;return;}
    let i=0;
    async function worker(){
      while(i<sources.length){
        const source=sources[i++];
        try{entries.push(...await collect(source));}
        catch(e){failures.push({title:source.title,path:source.path,message:String(e.message??e)});}
      }
    }
    await Promise.all(Array.from({length:5},()=>worker()));
    entries.sort((a,b)=>Number(b.updated??0)-Number(a.updated??0));
    loading=false;
  }
  const filt=row=>{
    const st=row.status;
    if(currentStatus==='active'&&!(st==='DRAFT'||st==='PREPARED'||row.pending))return false;
    if(currentStatus!=='all'&&currentStatus!=='active'&&st!==currentStatus)return false;
    if(currentGroup!=='all'&&row.source.group!==currentGroup)return false;
    return normalize(row.name+' '+row.source.title+' '+row.source.group).includes(normalize(term));
  };
  function action(title,path,icon='arrow'){
    return `<a href="${esc(path)}" data-go="${esc(path)}" class="creation-action">${ico(icon,19)}<span>${esc(title)}</span>${ico('arrow',15)}</a>`;
  }
  function renderCard(row){
    const source=row.source,status=statusLabels[row.status]??row.status;
    return `<article class="creation-record">
      <div class="creation-record-icon">${ico(source.icon,27)}</div>
      <div class="creation-record-body"><span class="eyebrow">${esc(source.title)}</span>
      <h3>${esc(row.name)}</h3><span class="creation-state" data-state="${esc(row.status)}">${esc(status)}${row.pending?' · alterações por publicar':''}</span></div>
      <a class="btn" href="${esc(source.path+'/'+row.id)}" data-go="${esc(source.path+'/'+row.id)}">${row.status==='ARCHIVED'?'Ver registro':'Continuar editando'} ${ico('arrow',15)}</a>
    </article>`;
  }
  function page(){
    if(!allowed())return `${label('ACESSO RESTRITO')}${empty('Acesso reservado ao Mestre.')}`;
    const visible=entries.filter(filt);
    const counts={active:entries.filter(e=>e.status==='DRAFT'||e.status==='PREPARED'||e.pending).length,DRAFT:entries.filter(e=>e.status==='DRAFT').length,PREPARED:entries.filter(e=>e.status==='PREPARED').length,PUBLISHED:entries.filter(e=>e.status==='PUBLISHED').length,ARCHIVED:entries.filter(e=>e.status==='ARCHIVED').length,all:entries.length};
    return `${label('OFICINA DO MESTRE','MINHAS CRIAÇÕES')}
      <section class="creations-hero"><div class="creations-hero-content"><span class="eyebrow">SEU ATELIÊ MÁGICO</span>
      <h1 class="display">Minhas Criações</h1><p>Comece algo novo ou retome exatamente o que estava preparando. Tudo continua salvo em sua oficina.</p>
      </div></section>
      <div class="creation-section-heading"><h2 class="head2">O que deseja criar?</h2>${button('Todas as oficinas','/portal/mestre/oficinas','book')}</div>
      <div class="creation-new-grid">${featured.map(id=>{const s=sources.find(x=>x.id===id);return action('Criar '+(id==='books'?'livro':id==='lessons'?'aula':id==='newspapers'?'edição':id==='quests'?'missão':id==='npcs'?'NPC':'item'),s.path+'/novo',s.icon);}).join('')}</div>
      <div class="creation-section-heading"><div><h2 class="head2">Continuar de onde parei</h2><p class="muted">Rascunhos, preparados, publicados e arquivos, sem procurar em cada oficina.</p></div><button class="btn ghost" data-creations-refresh type="button">Atualizar lista</button></div>
      <nav class="creations-tabs" aria-label="Filtrar por estado">${[['active','Em andamento'],['DRAFT','Rascunhos'],['PREPARED','Preparados'],['PUBLISHED','Publicados'],['ARCHIVED','Arquivados'],['all','Todos']].map(([id,title])=>`<button type="button" data-creations-status="${id}" aria-pressed="${currentStatus===id}">${esc(title)} <span>${counts[id]}</span></button>`).join('')}</nav>
      <form class="creations-search" data-creations-search><label class="field">Pesquisar suas criações<input name="q" type="search" maxlength="120" placeholder="Nome de NPC, missão, item, livro..." value="${esc(term)}"></label><label class="field">Categoria<select name="group">${[['all','Todas as categorias'],...['Narrativa','Mundo','Comércio','Hogwarts','Publicações','Acervos','Sistema'].map(n=>[n,n])].map(([v,t])=>`<option value="${esc(v)}" ${currentGroup===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label><button class="btn ghost" type="submit">Buscar</button></form>
      ${failures.length?`<section class="creation-warning" role="status">Algumas oficinas não puderam ser consultadas. Os resultados abaixo podem estar incompletos. ${failures.map(f=>`<a href="${esc(f.path)}" data-go="${esc(f.path)}">${esc(f.title)}</a>`).join(' · ')}</section>`:''}
      <div class="creation-results" aria-live="polite">${loading?'<p>Consultando suas criações…</p>':visible.length?visible.map(renderCard).join(''):empty(term||currentStatus!=='active'||currentGroup!=='all'?'Nenhum registro encontrado com esses filtros.':'Nenhuma criação em andamento. Comece pelas opções acima.')}</div>
      <div class="group">${button('Central do Mestre','/portal/mestre','shield')}${button('Oficina Geral','/portal/mestre/oficinas','book')}</div>`;
  }
  function attach(root){
    root.addEventListener('click',e=>{
      const status=e.target.closest('[data-creations-status]');
      if(status){e.preventDefault();currentStatus=status.dataset.creationsStatus;render();return;}
      const refresh=e.target.closest('[data-creations-refresh]');
      if(refresh){e.preventDefault();if(loading)return;loading=true;render();void load().then(render);return;}
    });
    root.addEventListener('submit',e=>{
      if(!e.target.matches('[data-creations-search]'))return;
      e.preventDefault();
      const data=new FormData(e.target);term=String(data.get('q')??'').trim().slice(0,120);currentGroup=String(data.get('group')??'all');render();
    });
  }
  return {handles,load,page,attach};
}
