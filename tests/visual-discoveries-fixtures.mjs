import assert from 'node:assert/strict';
import {quickCreateRequest} from '../public/quick-create.js';
export const discoveryPolicy=(characters=['atlas'])=>({audience:'SELECTED',characters,groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null});
export async function questDiscovery(f,{title='Salas Particulares',fileId=null,characters=['atlas']}={}){
 const body=quickCreateRequest('quests',new Map([['name',title],['description','Uma passagem discreta guarda novas histórias.'],['fileId',fileId??''],['alt',fileId?'Corredor iluminado por velas':'']]),{}).body;body.policy=discoveryPolicy(characters);body.private.notes='SEGREDO DO MESTRE';
 let r=await f.master.request('/api/master/campaign/quests',{method:'POST',body});assert.equal(r.status,201,JSON.stringify(r.value));let q=r.value;
 r=await questCommand(f,q,'publish');q=r;
 return questCommand(f,q,'release',{characters});
}
export async function questCommand(f,q,action,extra={}){const r=await f.master.request('/api/master/campaign/quests/'+q.id+'/'+action,{method:'POST',body:{version:q.version,...extra}});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
export async function contentDiscovery(f,kind,payload,characters=['atlas']){const r=await f.master.request('/api/master/content/'+kind,{method:'POST',body:{payload,policy:discoveryPolicy(characters),privateNotes:'SEGREDO DO MESTRE'}});assert.equal(r.status,201,JSON.stringify(r.value));return contentCommand(f,r.value,'publish');}
export async function contentCommand(f,r,action,extra={}){const response=await f.master.request('/api/master/content/'+r.kind+'/'+r.id+'/'+action,{method:'POST',body:{version:r.version,...extra}});assert.equal(response.status,200,JSON.stringify(response.value));return response.value;}
export const bookPayload=(fileId=null)=>({title:'O Livro dos Corredores',description:'Um volume sobre passagens conhecidas.',subject:'História da Magia',npcId:null,fileId,alt:fileId?'Biblioteca de Hogwarts':'',pages:[{id:'page-visual',title:'A primeira passagem',text:'Texto autorizado da página.',fileId,alt:fileId?'Ilustração da passagem':'',policy:discoveryPolicy()}],author:'',category:'NORMAL'});
