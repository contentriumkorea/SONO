import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
it('handles afterPack again after x64/arm64 bundles are merged into a universal app',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'musicboard-pack-')),mac=path.join(dir,'MusicBoard.app','Contents','MacOS');
  try{
    await mkdir(mac,{recursive:true});await writeFile(path.join(mac,'MusicBoard'),'unchanged executable');
    const require=createRequire(import.meta.url),module={exports:null as unknown as (context:unknown)=>Promise<void>};let plistCalls=0;
    runInNewContext(await readFile('scripts/after-pack.cjs','utf8'),{module,require:(id:string)=>id==='node:child_process'?{execFile:(_file:unknown,_args:unknown,callback:(error:null)=>void)=>{plistCalls++;callback(null);}}:require(id)});
    const context={electronPlatformName:'darwin',appOutDir:dir};
    await module.exports(context);await module.exports(context);
    expect(await readFile(path.join(mac,'SONO'),'utf8')).toBe('unchanged executable');await expect(access(path.join(mac,'MusicBoard'))).rejects.toThrow();expect(plistCalls).toBe(2);
    await module.exports({electronPlatformName:'win32',appOutDir:dir});expect(plistCalls).toBe(2);
  }finally{await rm(dir,{recursive:true,force:true});}
});
