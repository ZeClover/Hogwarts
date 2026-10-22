import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Client, Transaction, InValue, ResultSet } from '@libsql/client';

export type Row = Record<string, string | number | null>;
type Value = string | number | null;
export type Statement = {sql: string; args: Value[]};
type RunResult = { changes: number | bigint; lastInsertRowid: number | bigint | undefined };
export interface AsyncDatabase {
  readonly asynchronous: true;
  prepare(sql: string): {
    get(...args: Value[]): Promise<Row | undefined>;
    all(...args: Value[]): Promise<Row[]>;
    run(...args: Value[]): Promise<RunResult>;
  };
  exec(sql: string): Promise<void>;
  batchRead(sql: string[]): Promise<Row[][]>;
  batchWrite(statements: Statement[]): Promise<void>;
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  close(): void;
}

class Gate {
  private tail: Promise<void> = Promise.resolve();
  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  }
}

// A transaction owns the local connection until it finishes. Async handlers
// outside that transaction wait, while its own statements can use the connection.
export function localDatabase(raw: DatabaseSync): AsyncDatabase {
  const gate = new Gate(), context = new AsyncLocalStorage<boolean>();
  const use = <T>(fn: () => T): Promise<T> => context.getStore() ? Promise.resolve().then(fn) : gate.run(fn);
  return {
    asynchronous: true,
    prepare(sql) {
      return {
        get: (...args) => use(() => raw.prepare(sql).get(...args as SQLInputValue[]) as Row | undefined),
        all: (...args) => use(() => raw.prepare(sql).all(...args as SQLInputValue[]) as Row[]),
        run: (...args) => use(() => raw.prepare(sql).run(...args as SQLInputValue[]))
      };
    },
    exec: sql => use(() => { raw.exec(sql); }),
    batchRead: sql => use(() => {
      const nested=!!context.getStore();
      if(!nested)raw.exec('BEGIN');
      try{const result=sql.map(statement=>raw.prepare(statement).all() as Row[]);if(!nested)raw.exec('COMMIT');return result;}
      catch(error){if(!nested)raw.exec('ROLLBACK');throw error;}
    }),
    batchWrite: statements => use(() => {if(!context.getStore())throw new Error('O lote precisa de uma transação.');for(const statement of statements)raw.prepare(statement.sql).run(...statement.args);}),
    async transaction(fn) {
      if(context.getStore()) throw new Error('Transação aninhada não permitida.');
      return gate.run(() => context.run(true, async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const value = await fn(); raw.exec('COMMIT'); return value; }
        catch(error) { raw.exec('ROLLBACK'); throw error; }
      }));
    },
    close: () => raw.close()
  };
}

function rows(result: ResultSet): Row[] {
  return result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]])) as Row);
}

// Each request's interactive transaction has its own remote stream. No shared
// mutable 'current transaction' can leak one user's operations into another's.
export function remoteDatabase(client: Client): AsyncDatabase {
  const context = new AsyncLocalStorage<Transaction>();
  const writes = new Gate();
  const connection = () => context.getStore() ?? client;
  return {
    asynchronous: true,
    prepare(sql) {
      const execute = (args: Value[]) => connection().execute({sql, args: args as InValue[]});
      return {
        get: async (...args) => rows(await execute(args))[0],
        all: async (...args) => rows(await execute(args)),
        run: async (...args) => { const result = await execute(args); return {changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid}; }
      };
    },
    exec: sql => connection().executeMultiple(sql),
    batchRead: async sql => {
      const tx=context.getStore();
      const result=tx?await tx.batch(sql):await client.batch(sql,'read');
      return result.map(rows);
    },
    batchWrite: async statements => {
      const tx=context.getStore();
      if(!tx)throw new Error('O lote precisa de uma transação.');
      await tx.batch(statements);
    },
    async transaction(fn) {
      if(context.getStore()) throw new Error('Transação aninhada não permitida.');
      return writes.run(async () => {
        const tx = await client.transaction('write');
        try {
          return await context.run(tx, async () => {
            const value = await fn(); await tx.commit(); return value;
          });
        } catch(error) { await tx.rollback().catch(() => {}); throw error; }
        finally { tx.close(); }
      });
    },
    close: () => client.close()
  };
}
