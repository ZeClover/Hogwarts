// Decoration receives only already authorized records; it never fetches a catalogue.
export function contextArt(file,alt,esc){return `<img class="context-art" src="/assets/${esc(file)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;}
export function lessonArt(record){
 const subject=String(record.meta?.[0]??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return ({feiticos:'aula_sala_clara.webp',pocoes:'aula_classe_ornamentada.webp',herbologia:'aula_herbologia_estufa.webp',transfiguracao:'aula_sala_de_pedra.webp','defesa contra as artes das trevas':'aula_sala_gotica.webp',astronomia:'aula_instrumentos.webp'})[subject]??'aula_sala_clara.webp';
}
export function chocolateFace(record,esc){
 return `<div class="frog-face"><div class="frog-portrait">${record.image?`<img src="${esc(record.image)}" alt="${esc(record.alt)}" loading="lazy" decoding="async">`:''}</div><img class="frog-frame" src="/assets/moldura_sapos_frente_transparente.webp" alt="" loading="lazy" decoding="async" width="990" height="905"><span class="frog-name" title="${esc(record.title)}">${esc(record.title)}</span></div>`;
}
