import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreationsOffice} from '../public/creations.js';

function fakeOffice(state, records = {}) {
  const calls=[];
  const api=async(path)=>{
    calls.push(path);
    const base=path.split('?')[0];
    const page=Number(new URLSearchParams(path.split('?')[1]??'').get('page')??1);
    const rows=records[base]??[];
    return {items:rows.slice((page-1)*20,page*20),total:rows.length,pageSize:20};
  };
  const office=createCreationsOffice({
    api,state,esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    ico:n=>'<span>'+n+'</span>',
    label:n=>n,
    empty:n=>'<p>'+n+'</p>',
    button:(name,href)=>'<a href="'+href+'">'+name+'</a>',
    render:()=>{}
  });
  return {office,calls};
}

const master={session:{role:'MASTER'},view:null};
test('central do Mestre lista rascunhos de oficinas diferentes e caminhos para retomar',async()=>{
  const data={
    '/api/master/workshop/npcs':[{id:'npc-1',status:'DRAFT',payload:{name:'Auror misterioso'}}],
    '/api/master/campaign/quests':[{id:'quest-1',status:'PREPARED',payload:{title:'Pistas na Floresta'}}],
    '/api/master/workshop/items':[{id:'item-1',status:'PUBLISHED',hasUnpublishedChanges:true,payload:{name:'Varinha alterada'}}],
    '/api/master/content/books':[{id:'book-1',status:'DRAFT',payload:{title:'Livro da Ala Norte'}}]
  };
  const {office,calls}=fakeOffice(master,data);
  assert.equal(office.handles('/portal/mestre/criacoes'),true);
  await office.load();
  const html=office.page();
  for(const name of ['Auror misterioso','Pistas na Floresta','Varinha alterada','Livro da Ala Norte']){
    assert.ok(html.includes(name),name);
  }
  assert.ok(html.includes('/portal/mestre/oficinas/npcs/npc-1'));
  assert.ok(html.includes('/portal/mestre/oficinas/missoes/quest-1'));
  assert.ok(html.includes('/portal/mestre/oficinas/conteudos/books/book-1'));
  assert.ok(html.includes('alterações por publicar'));
  assert.ok(calls.length>=26);
});

test('a central não faz leitura administrativa quando estiver em prévia de jogador',async()=>{
  const state={session:{role:'MASTER'},view:'atlas'};
  const {office,calls}=fakeOffice(state);
  await office.load();
  assert.equal(calls.length,0);
  assert.match(office.page(),/Acesso reservado ao Mestre/);
});

test('não busca criações administrativas para conta PLAYER',async()=>{
  const state={session:{role:'PLAYER'},view:null};
  const {office,calls}=fakeOffice(state);
  await office.load();
  assert.equal(calls.length,0);
  assert.match(office.page(),/Acesso reservado ao Mestre/);
});
