import { stat,readFile,writeFile,mkdir,rename,rm } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import path from 'node:path';
import { WAVEFORM_POINTS } from '../src/shared/waveform';
import { wavPeaks } from './wav-peaks';
const analyses=new Map<string,Promise<number[]|null>>();
const valid=(peaks:unknown):peaks is number[]=>Array.isArray(peaks)&&peaks.length===WAVEFORM_POINTS&&peaks.every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1);
async function fingerprint(file:string){const info=await stat(file);if(!info.isFile())throw new Error('음원을 읽을 수 없습니다.');return {key:createHash('sha256').update(`wave-v1:${file}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`).digest('hex'),size:info.size};}
export async function readWaveform(file:string,directory:string):Promise<{key:string;size:number;peaks:number[]|null}>{
  const info=await fingerprint(file);let peaks:number[]|null=null;
  try{const value=JSON.parse(await readFile(path.join(directory,`${info.key}.json`),'utf8'));if(valid(value))peaks=value;}catch{}
  if(!peaks&&path.extname(file).toLowerCase()==='.wav'){
    if(!analyses.has(info.key))analyses.set(info.key,wavPeaks(file).finally(()=>analyses.delete(info.key)));
    peaks=await analyses.get(info.key)!;
    if(peaks)await writeWaveform(file,directory,info.key,peaks);
  }
  return {...info,peaks};
}
export async function writeWaveform(file:string,directory:string,key:string,peaks:unknown):Promise<void>{
  if(!valid(peaks)||!/^\w{64}$/.test(key)||(await fingerprint(file)).key!==key)throw new Error('음원 파형이 변경되었거나 올바르지 않습니다.');
  await mkdir(directory,{recursive:true});const target=path.join(directory,`${key}.json`),temp=`${target}.${randomUUID()}.tmp`;
  try{await writeFile(temp,JSON.stringify(peaks));await rename(temp,target);}finally{await rm(temp,{force:true});}
}
