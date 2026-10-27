import {enqueueOnce,registerEvent} from './events.ts';
import {policyAllows,imageStamp} from './editorial.ts';
import {randomUUID} from 'node:crypto';
import {one,type DB} from './db.ts';
// Call within the same transaction as the debit/grant, never infer possession from a receipt.
export async function giveItem(db: DB, actorId: string, characterId: string, itemId: string, quantity: number, sourceKey: string, snapshot: unknown) {
    await db.prepare('INSERT INTO item_possessions(id,character_id,item_id,quantity,source_key,snapshot_json,actor_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_key) DO NOTHING').run(randomUUID(),characterId,itemId,quantity,sourceKey,JSON.stringify(snapshot),actorId);
    const possession=await one(db,'SELECT id FROM item_possessions WHERE source_key=?',sourceKey);
    if(possession)await enqueueOnce(db,characterId,'ITEM_GRANTED',String(possession.id));
}

registerEvent('ITEM_GRANTED',async(db,v,e)=>{
 const row=await one(db,'SELECT * FROM item_possessions WHERE id=? AND character_id=?',String(e.resource_id),v.characterId);
 if(!row)return null;
 const saved=JSON.parse(String(row.snapshot_json)),item=await one(db,"SELECT * FROM catalog_items WHERE id=? AND status='PUBLISHED'",String(row.item_id));
 const p=item&&await policyAllows(db,v,JSON.parse(String(item.published_policy_json)))?JSON.parse(String(item.published_json)):null;
 return {kind:'NOVO ITEM RECEBIDO',title:String(saved.title??'Item recebido'),text:String(saved.description??''),image:p?.fileId?`/api/workshop/items/${item!.id}/image?stamp=${imageStamp(item!)}`:null,alt:String(p?.alt??''),href:'/portal/documentos'};
});
