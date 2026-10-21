import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../dist/server.js';
import { token, digest, now } from '../dist/auth.js';

export const password='Somente-para-testes-1890!';
export async function commercialFixture(f,{stock=5,price=29,fileId=null}={}){
 const policy={audience:'ALL',characters:[],groups:[],houses:[],schoolYears:[],cohorts:[],excludedCharacters:[],regionId:null,locationId:null};
 const internal={category:'',quality:'',materials:'',properties:'',magicDegree:'',activation:'',uses:'',frequency:'',craftingComplexity:'',availability:'',rarity:'',requirements:'',secretText:'SEGREDO COMERCIAL',notes:'',referenceValueNuques:99999,chosenPriceNuques:88888,effects:[]};
 let item=(await f.master.request('/api/master/workshop/items',{method:'POST',body:{payload:{name:'MERCADORIA DE TESTE',description:'Descrição pública da mercadoria.',fileId,alt:fileId?'Ilustração de teste':'',crop:{x:0,y:0,width:100,height:100}},policy,private:internal}})).value;item=(await f.master.request('/api/master/workshop/items/'+item.id+'/publish',{method:'POST',body:{version:item.version}})).value;
 const create=async(kind,payload)=>{const r=await f.master.request('/api/master/content/'+kind,{method:'POST',body:{payload,policy,privateNotes:'SEGREDO OFERTA'}});if(r.status!==201)throw new Error(JSON.stringify(r.value));const p=await f.master.request('/api/master/content/'+kind+'/'+r.value.id+'/publish',{method:'POST',body:{version:r.value.version}});if(p.status!==200)throw new Error(JSON.stringify(p.value));return p.value;};
 const shop=await create('shops',{title:'ESTABELECIMENTO DE TESTE',description:'',locationId:'biblioteca',npcId:null,fileId:null,alt:'',hasCatalog:true,available:true});const offer=await create('offers',{title:'Oferta privada',itemId:item.id,shopId:shop.id,available:true,priceNuques:price,stock,conditions:'CONDIÇÃO PRIVADA'});return {item,shop,offer};
}
export async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'hogwarts-test-'));
  const config={port:0,host:'127.0.0.1',origin:'http://127.0.0.1',secure:false,dataDir:directory,publicDir:resolve('public'),migrationsDir:resolve('migrations')};
  const app=createApplication(config);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  config.port=app.server.address().port;config.origin=`http://127.0.0.1:${config.port}`;
  const client=()=>({
    cookie:'',csrf:'',
    async request(path,{method='GET',body,headers={},csrf=true,origin=true,raw=false}={}){
      const h={...headers};
      if(this.cookie)h.Cookie=this.cookie;
      if(origin&&!h.Origin)h.Origin=config.origin;
      if(csrf&&this.csrf)h['X-CSRF-Token']=this.csrf;
      if(body!==undefined&&!raw)h['Content-Type']='application/json';
      const response=await fetch(config.origin+path,{method,headers:h,body:body===undefined?undefined:raw?body:JSON.stringify(body)});
      const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
      const type=response.headers.get('content-type')??'';
      const value=type.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
      return {status:response.status,value,headers:response.headers};
    },
    async activate(raw,email){
      const result=await this.request('/api/auth/activate',{method:'POST',body:{email,password,token:raw}});
      if(result.status!==200)throw new Error(JSON.stringify(result));
      const session=await this.request('/api/session');this.csrf=session.value.csrf;return this;
    }
  });
  const bootstrap=token();
  app.db.prepare("INSERT INTO invites(id,token_hash,email,role,expires_at) VALUES(?,?,?,'MASTER',?)").run(randomUUID(),digest(bootstrap),'master@test.invalid',now()+3600);
  const master=await client().activate(bootstrap,'master@test.invalid');
  async function invite(character,email=`${character}@test.invalid`){
    const result=await master.request('/api/master/invites',{method:'POST',body:{email,role:'PLAYER',characterId:character}});
    if(result.status!==201)throw new Error(JSON.stringify(result));
    return new URLSearchParams(new URL(result.value.url).hash.slice(1)).get('convite');
  }
  const atlas=await client().activate(await invite('atlas'),'atlas@test.invalid');
  const eiris=await client().activate(await invite('eiris'),'eiris@test.invalid');
  return {...app,client,master,atlas,eiris,invite,password,
    async close(){await new Promise(resolve=>app.server.close(resolve));app.db.close();await rm(directory,{recursive:true,force:true});}
  };
}
