import {randomUUID} from 'node:crypto';
import {type DB} from './db.ts';
// Call within the same transaction as the debit/grant, never infer possession from a receipt.
export async function giveItem(db: DB, actorId: string, characterId: string, itemId: string, quantity: number, sourceKey: string, snapshot: unknown) {
    await db.prepare('INSERT INTO item_possessions(id,character_id,item_id,quantity,source_key,snapshot_json,actor_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_key) DO NOTHING').run(randomUUID(),characterId,itemId,quantity,sourceKey,JSON.stringify(snapshot),actorId);
}
