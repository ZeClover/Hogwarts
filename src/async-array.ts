export async function mapAsync<T, U>(items: readonly T[], fn: (value: T, index: number, items: readonly T[]) => U | Promise<U>): Promise<U[]> {
  const result: U[] = [];
  for(let index=0;index<items.length;index++) result.push(await fn(items[index]!,index,items));
  return result;
}
export async function filterAsync<T>(items: readonly T[], fn: (value: T, index: number) => unknown): Promise<T[]> {
  const result: T[] = [];
  for(let index=0;index<items.length;index++) if(await fn(items[index]!,index)) result.push(items[index]!);
  return result;
}
export async function flatMapAsync<T, U>(items: readonly T[], fn: (value: T, index: number, items: readonly T[]) => U | readonly U[] | Promise<U | readonly U[]>): Promise<U[]> {
  return (await mapAsync(items,fn)).flat() as U[];
}
export async function someAsync<T>(items: readonly T[], fn: (value: T, index: number) => unknown): Promise<boolean> {
  for(let index=0;index<items.length;index++) if(await fn(items[index]!,index)) return true;
  return false;
}
export async function everyAsync<T>(items: readonly T[], fn: (value: T, index: number) => unknown): Promise<boolean> {
  for(let index=0;index<items.length;index++) if(!await fn(items[index]!,index)) return false;
  return true;
}
export async function findAsync<T>(items: readonly T[], fn: (value: T, index: number) => unknown): Promise<T | undefined> {
  for(let index=0;index<items.length;index++) if(await fn(items[index]!,index)) return items[index];
}
export async function forEachAsync<T>(items: readonly T[], fn: (value: T, index: number) => unknown): Promise<void> {
  for(let index=0;index<items.length;index++) await fn(items[index]!,index);
}
