import {randomUUID} from 'node:crypto';
import {all,one,transaction,audit,type DB} from './db.ts';
import {fail,type Session} from './auth.ts';
import {fields,text} from './http.ts';
import {expected,exists} from './editorial.ts';
import {academicYears} from './calendar-model.ts';
export async function latestCycle(db:DB){return (await one(db,'SELECT id FROM cup_cycles ORDER BY created_at DESC,rowid DESC LIMIT 1'))?.id as string|undefined;}
export async function cycleState(db:DB,id:string,admin=false){
 const c=await one(db,'SELECT * FROM cup_cycles WHERE id=?',id)??fail(404,'Ciclo não encontrado.');
 const houses:{id:string|number|null;name:string|number|null;crest:string;points:number}[]=[];
 for(const h of await all(db,'SELECT * FROM houses'))houses.push({id:String(h.id),name:String(h.name),crest:'/assets/'+h.crest,points:Number((await one(db,'SELECT COALESCE(SUM(amount),0) n FROM cup_cycle_entries WHERE cycle_id=? AND house_id=?',id,String(h.id)))!.n)});
 houses.sort((a,b)=>b.points-a.points);const ranked=houses.map(h=>({...h,rank:houses.filter(o=>o.points>h.points).length+1}));
 const history=(await all(db,'SELECT snapshot_json FROM cup_cycle_results ORDER BY rowid DESC')).map(r=>JSON.parse(String(r.snapshot_json)));
 return {academicYear:id,years:[...await academicYears(db),...(await all(db,'SELECT id,label FROM cup_cycles ORDER BY rowid DESC')).map(r=>({id:r.id,name:r.label}))],competition:{status:c.status,houses:ranked,result:history.find(r=>r.academicYear===id)??null},history:[...history,...(await all(db,'SELECT snapshot_json FROM house_results ORDER BY rowid DESC')).map(r=>JSON.parse(String(r.snapshot_json)))],...(admin?{version:c.version,characters:await all(db,'SELECT id,name FROM characters'),events:[],entries:(await all(db,'SELECT * FROM cup_cycle_entries WHERE cycle_id=? ORDER BY rowid DESC',id))}: {})};
}
export async function newCycle(db:DB,actor:Session,data:Record<string,unknown>){
 fields(data,['label','commandKey','confirm']);if(data.confirm!==true)fail(422,'Confirme o novo ciclo.');const label=text(data.label,120),key=text(data.commandKey,100);
 return transaction(db,async()=>{const old=await one(db,'SELECT id,label FROM cup_cycles WHERE command_key=?',key);if(old){if(old.label!==label)fail(409,'Operação já usada.');return cycleState(db,String(old.id),true);}const id='cycle-'+randomUUID();await db.prepare('INSERT INTO cup_cycles(id,label,command_key) VALUES(?,?,?)').run(id,label,key);await audit(db,actor.userId,'CUP_CYCLE_CREATED','CUP_CYCLE',id);return cycleState(db,id,true);});
}
export async function cycleCommand(db:DB,actor:Session,id:string,action:string,data:Record<string,unknown>){
 if(!['points','close','reopen'].includes(action))fail(404,'Ação não encontrada.');
 fields(data,action==='points'?['academicYear','version','houseId','amount','reason','characterId','eventId','commandKey','confirm']:action==='close'?['academicYear','version','houseId','confirm']:['academicYear','version','reason','confirm']);
 if(data.confirm!==true)fail(422,'Confirme a operação.');
 return transaction(db,async()=>{const c=await one(db,'SELECT * FROM cup_cycles WHERE id=?',id)??fail(404,'Ciclo não encontrado.');
 if(action==='points'){
 const amount=data.amount;if(typeof amount!=='number'||!Number.isSafeInteger(amount)||!amount||Math.abs(amount)>1e6)fail(400,'Informe pontos inteiros, diferentes de zero.');
 const house=text(data.houseId,100),reason=text(data.reason??'',2000,false),key=id+':'+text(data.commandKey,100),char=data.characterId?text(data.characterId,100):null;await exists(db,'houses',house);if(char)await exists(db,'characters',char);
 const old=await one(db,'SELECT * FROM cup_cycle_entries WHERE command_key=?',key);if(old){if(old.amount!==amount||old.house_id!==house||old.reason!==reason||old.character_id!==char)fail(409,'Operação já usada com outros dados.');return cycleState(db,id,true);}
 expected(c,data.version);if(c.status!=='OPEN')fail(409,'Reabra a competição.');
 const sum=Number((await one(db,'SELECT COALESCE(SUM(amount),0) n FROM cup_cycle_entries WHERE cycle_id=? AND house_id=?',id,house))!.n);if(Math.abs(sum+amount)>1e9)fail(422,'Total fora do limite.');
 await db.prepare('INSERT INTO cup_cycle_entries(id,cycle_id,house_id,amount,reason,character_id,command_key,actor_id) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),id,house,amount,reason,char,key,actor.userId);
 }else if(action==='close'){
 const house=text(data.houseId,100);await exists(db,'houses',house);
 if(c.status==='CLOSED'){const r=await cycleState(db,id,true);if(r.competition.result.winnerHouseId!==house)fail(409,'Reabra antes de mudar a vencedora.');return r;}
 expected(c,data.version);const state=await cycleState(db,id);const snapshot={revision:Number(c.version)+1,academicYear:id,academicYearLabel:c.label,winnerHouseId:house,houses:state.competition.houses};await db.prepare('INSERT INTO cup_cycle_results(id,cycle_id,version,snapshot_json,actor_id) VALUES(?,?,?,?,?)').run(randomUUID(),id,Number(c.version)+1,JSON.stringify(snapshot),actor.userId);await db.prepare("UPDATE cup_cycles SET status='CLOSED' WHERE id=?").run(id);
 }else{expected(c,data.version);if(c.status!=='CLOSED')fail(409,'O ciclo já está aberto.');text(data.reason,2000);await db.prepare("UPDATE cup_cycles SET status='OPEN' WHERE id=?").run(id);}
 await db.prepare('UPDATE cup_cycles SET version=version+1 WHERE id=?').run(id);await audit(db,actor.userId,'CUP_CYCLE_'+action.toUpperCase(),'CUP_CYCLE',id);return cycleState(db,id,true);
 });
}
