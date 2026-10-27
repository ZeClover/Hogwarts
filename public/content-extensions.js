const registry=new Map();
export function registerContentExtension(kinds,extension){for(const kind of kinds)registry.set(kind,extension);}
export function contentExtension(kind){return registry.get(kind);}
