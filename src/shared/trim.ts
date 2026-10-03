import type { Track } from './types';
export function sanitizeTrim(value:unknown,duration:number):Track['trim']{
  if(!value||typeof value!=='object'||!Number.isFinite(duration)||duration<=0)return;
  const raw=value as {start?:unknown;end?:unknown};
  if(typeof raw.start!=='number'||typeof raw.end!=='number'||!Number.isFinite(raw.start)||!Number.isFinite(raw.end))return;
  const start=Math.max(0,Math.min(duration,raw.start)),end=Math.max(0,Math.min(duration,raw.end));
  if(end-start<.05||(start===0&&end===duration))return;return {start,end};
}
export function trimBounds(track:Pick<Track,'duration'|'trim'>,duration=track.duration){
  const total=Number.isFinite(duration)?Math.max(0,duration):0,range=sanitizeTrim(track.trim,total);
  const start=range?.start??0,end=range?.end??total;return {start,end,duration:end-start};
}
export function parseTrimTime(value:string):number|null{
  const text=value.trim();if(!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(text))return null;
  const parts=text.split(':').map(Number);if(parts.slice(1).some(p=>p>=60))return null;
  const time=parts.reduce((sum,n)=>sum*60+n,0);return Number.isFinite(time)?time:null;
}
export function trimTime(value:number):string{
  const milliseconds=Math.round(Math.max(0,value)*1000),minutes=Math.floor(milliseconds/60000),seconds=(milliseconds%60000)/1000;
  const [whole,fraction]=seconds.toFixed(3).split('.'),tail=fraction.replace(/0+$/,'');
  return `${minutes}:${whole.padStart(2,'0')}${tail?'.'+tail:''}`;
}
