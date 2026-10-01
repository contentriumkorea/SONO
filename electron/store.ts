import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyState, sanitizeState } from '../src/shared/library';
import type { AppState } from '../src/shared/types';
export async function readState(file:string):Promise<{state:AppState;warning?:string}> {
  try { return {state:sanitizeState(JSON.parse(await readFile(file,'utf8')))}; }
  catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT') return {state:emptyState()};
    try{return {state:sanitizeState(JSON.parse(await readFile(`${file}.bak`,'utf8'))),warning:'저장 파일을 읽을 수 없어 이전 상태를 복구했습니다.'};}
    catch{return {state:emptyState(),warning:'저장 파일을 읽을 수 없습니다. 기존 파일은 보존했습니다.'};}
  }
}
const pending=new Map<string,Promise<void>>();
export function writeState(file:string,state:AppState):Promise<void> {
  const snapshot=JSON.stringify(sanitizeState(state));
  const task=(pending.get(file)??Promise.resolve()).catch(()=>{}).then(async()=>{
    await mkdir(path.dirname(file),{recursive:true});
    try { const old=await readFile(file,'utf8'); JSON.parse(old); await copyFile(file,`${file}.bak`); }
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'){try{await copyFile(file,`${file}.corrupt`);}catch{ /* primary file may not be readable */ }}}
    await writeFile(`${file}.tmp`,snapshot,'utf8'); await rename(`${file}.tmp`,file);
  });
  pending.set(file,task); return task;
}
