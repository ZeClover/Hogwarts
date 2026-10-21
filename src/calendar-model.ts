import {one,all,type DB} from './db.ts';
export function academicYears(db:DB){return all(db,'SELECT id,label,start_year,archived FROM school_years ORDER BY start_year').map(r=>({id:String(r.id),name:String(r.label),archived:!!r.archived}));}
export function knownAcademicYear(db:DB,id:unknown){return typeof id==='string'&&!!one(db,'SELECT id FROM school_years WHERE id=?',id);}
export function calendarHeader(db:DB){const row=one(db,'SELECT published_json FROM calendar_state WHERE id=1')!,p=JSON.parse(String(row.published_json)) as {academicYear:string;narrativeDate:string};return {...p,academicYearLabel:one(db,'SELECT label FROM school_years WHERE id=?',p.academicYear)!.label};}
