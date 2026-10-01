import { afterEach, expect, it } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';

const exec=promisify(execFile),shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh';
const posix=(p:string)=>process.platform==='win32'?p.replace(/\\/g,'/').replace(/^([A-Za-z]):/,(m,d)=>`/${d.toLowerCase()}`):p;
const helper=path.resolve('resources/mac-update.sh'),dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function fixture(fail=false){
  const dir=await mkdtemp(path.join(tmpdir(),process.platform==='darwin'?"sono-install-quote'-":'sono-install-'));dirs.push(dir);
  const token=randomUUID(),workspace=path.join(dir,token),target=path.join(dir,'SONO with spaces.app'),candidate=`${target}.sono-update-${token}.app`;
  for(const app of [target,candidate])await mkdir(path.join(app,'Contents','MacOS'),{recursive:true});await mkdir(workspace);
  await writeFile(path.join(target,'version'),'old');await writeFile(path.join(candidate,'version'),'new');
  await writeFile(path.join(target,'Contents','MacOS','SONO'),'#!/bin/sh\nprintf old > "$SONO_TEST_RESTART"\n',{mode:0o755});
  await writeFile(path.join(candidate,'Contents','MacOS','SONO'),fail?'#!/bin/sh\nexit 1\n':'#!/bin/sh\nprintf 0.2.0 > "$SONO_TEST_HEALTH"\n',{mode:0o755});
  const env={...process.env,SONO_TEST_HEALTH:posix(path.join(workspace,'health')),SONO_TEST_RESTART:posix(path.join(dir,'restarted'))};
  const args=(pid='99999999',c=candidate)=>[helper,pid,posix(target),posix(c),posix(workspace),token,'0.2.0',env.SONO_TEST_HEALTH,fail?'5':'50'];
  return {dir,target,candidate,workspace,token,env,args};
}
it('replaces the app, relaunches it and removes the backup only after health confirmation',async()=>{
  const f=await fixture();await exec(shell,f.args(),{env:f.env});
  expect(await readFile(path.join(f.target,'version'),'utf8')).toBe('new');
  await expect(access(`${f.target}.sono-backup-${f.token}`)).rejects.toThrow();
});
it('restores and relaunches the previous app if the new app does not become healthy',async()=>{
  const f=await fixture(true);await expect(exec(shell,f.args(),{env:f.env})).rejects.toThrow();
  expect(await readFile(path.join(f.target,'version'),'utf8')).toBe('old');
  await expect.poll(async()=>readFile(path.join(f.dir,'restarted'),'utf8')).toBe('old');
});
it('waits for the old process to stop before moving its bundle',async()=>{
  const f=await fixture();const old=spawn(shell,['-c','echo $$; read value'],{stdio:['pipe','pipe','ignore']});
  const pid=await new Promise<string>(resolve=>old.stdout.once('data',data=>resolve(String(data).trim())));
  const installing=exec(shell,f.args(pid),{env:f.env}).then(result=>({result}),error=>({error}));
  try{await new Promise(r=>setTimeout(r,150));expect(await readFile(path.join(f.target,'version'),'utf8')).toBe('old');}
  finally{old.stdin.end('exit\n');}
  const outcome=await installing;if('error' in outcome)throw outcome.error;
  expect(await readFile(path.join(f.target,'version'),'utf8')).toBe('new');
});
it('rejects an unrelated replacement path without touching the old app',async()=>{
  const f=await fixture();await expect(exec(shell,f.args('99999999',f.dir),{env:f.env})).rejects.toThrow();
  expect(await readFile(path.join(f.target,'version'),'utf8')).toBe('old');
});
