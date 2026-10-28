import {all, one, type DB} from './db.ts';
import {fields, record, stringIds, text} from './http.ts';
import {fail} from './auth.ts';

export const sheetTextFields = ['period','obtainedAt','mainLocation','duration','description','mainObjective','secondaryObjectives','startConditions','development','clueNotes','success','partialSuccess','failure','abandonment','decisions','mainReward','additionalRewards','rewardNarrative','characterConsequences','hogwartsConsequences','worldConsequences','continuity','protagonistConsequences'] as const;
export const sheetStatuses = ['Ideia','Em desenvolvimento','Aprovada','Em andamento','Concluída','Falhada'];
export type QuestSheet = Record<string, string | string[] | {id:string;quantity:number}[]>;
export async function validateQuestSheet(db: DB, value: unknown, previous?: QuestSheet): Promise<QuestSheet | undefined> {
  if(value===undefined)return previous;
  const input=record(value);
  fields(input,['code','schoolYear','difficulty','planningStatus','npcIds','items',...sheetTextFields]);
  const p={...previous,...input};
  const result: QuestSheet={code:previous?.code as string??''};
  for(const key of sheetTextFields)result[key]=text(p[key]??'', ['description','development','clueNotes'].includes(key)?120000:40000,false);
  for(const [key,choices,fallback] of [['schoolYear',['','1','2','3','4','5','6','7'],''],['difficulty',['Fácil','Moderada','Difícil','Especial'],'Moderada'],['planningStatus',sheetStatuses,'Ideia']] as const){
    const value=String(p[key]??fallback);if(!(choices as readonly string[]).includes(value))fail(400,'Confira '+key+' da missão.');result[key]=value;
  }
  const ids=stringIds(p.npcIds??[]);if(ids.length>100)fail(400,'Use até 100 personagens vinculados.');
  for(const id of ids)if(!await one(db,'SELECT id FROM npcs WHERE id=?',id))fail(400,'NPC indisponível.');result.npcIds=ids;
  if(!Array.isArray(p.items??[])||((p.items??[]) as unknown[]).length>100)fail(400,'Confira os itens da missão.');
  const items: {id:string;quantity:number}[]=[];for(const raw of (p.items??[]) as unknown[]){const item=record(raw);fields(item,['id','quantity']);const id=text(item.id,100),quantity=Number(item.quantity);if(typeof item.quantity!=='number'||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||items.some(i=>i.id===id))fail(400,'Confira a quantidade e os vínculos de itens.');if(!await one(db,'SELECT id FROM catalog_items WHERE id=?',id))fail(400,'Item indisponível.');items.push({id,quantity});}result.items=items;
  return result;
}

// Called after INSERT/UPDATE inside the quest transaction, which owns the write lock.
export async function assignQuestCode(db: DB, kind: string, sheet: QuestSheet = {}): Promise<QuestSheet> {
  if(sheet.code)return sheet;
  const prefix=kind==='Principal'?'MQ':kind==='Pessoal'||kind==='Missão individual'?'PQ':kind==='Evento'?'EV':'SQ';
  const rows=await all(db,"SELECT json_extract(private_json,'$.sheet.code') code FROM quests WHERE json_extract(private_json,'$.sheet.code') LIKE ?",prefix+'-%');
  let next=1;for(const row of rows){const value=Number(String(row.code).slice(prefix.length+1));if(Number.isSafeInteger(value))next=Math.max(next,value+1);}
  return {...sheet,code:prefix+'-'+String(next).padStart(3,'0')};
}
