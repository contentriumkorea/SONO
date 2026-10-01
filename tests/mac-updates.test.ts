import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MacUpdater, readMacRelease } from '../electron/mac-updates';
import { createUpdateService } from '../electron/updates';

const releasesUrl='https://github.com/contentriumkorea/SONO/releases';
const bytes=Buffer.from('verified app archive');
const release={tag_name:'v0.2.0',draft:false,prerelease:false,html_url:`${releasesUrl}/tag/v0.2.0`,assets:[
  {name:'SONO-0.2.0-mac-universal.dmg'},
  {name:'SONO-0.2.0-mac-universal.zip',size:bytes.length,digest:`sha256:${createHash('sha256').update(bytes).digest('hex')}`,browser_download_url:`${releasesUrl}/download/v0.2.0/SONO-0.2.0-mac-universal.zip`}
]};
const dirs:string[]=[];afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
async function setup(content=bytes){
  const dir=await mkdtemp(path.join(tmpdir(),'sono-mac-update-'));dirs.push(dir);
  const bundle=path.join(dir,'Applications','SONO.app');await mkdir(bundle,{recursive:true});
  const extract=vi.fn(async(zip:string,destination:string)=>{
    expect(await readFile(zip)).toEqual(bytes);const app=path.join(destination,'SONO.app');await mkdir(app,{recursive:true});await writeFile(path.join(app,'new-version'),'0.2.0');return app;
  });
  const fetcher=vi.fn(async(url:string)=>new Response(url.endsWith('/latest')?JSON.stringify(release):content));
  const install=vi.fn(async()=>{});
  const updater=new MacUpdater({version:'0.1.0',releasesUrl,bundlePath:bundle,cacheDir:path.join(dir,'updates'),fetch:fetcher as unknown as typeof fetch,extract,install});
  const flush=vi.fn(async()=>{});
  const service=createUpdateService({version:'0.1.0',releasesUrl,updater,readRelease:async()=>({version:'0.2.0'}),flush,openRelease:vi.fn()});
  return {service,updater,fetcher,extract,install,flush};
}
it('Mac downloads a verified zip with progress and installs after final data flush',async()=>{
  const {service,extract,install,flush}=await setup();const seen:string[]=[];service.subscribe(s=>seen.push(s.status));
  await service.check();expect(service.get()).toMatchObject({mode:'automatic',status:'available',latestVersion:'0.2.0'});
  await service.download();expect(service.get()).toMatchObject({status:'downloaded',percent:100});expect(seen).toContain('downloading');
  expect(extract).toHaveBeenCalledTimes(1);expect(install).not.toHaveBeenCalled();
  install.mockImplementation(async()=>{expect(flush).toHaveBeenCalledTimes(1);});
  await service.install();expect(install).toHaveBeenCalledTimes(1);
});
it('rejects a damaged archive before extracting or replacing the app',async()=>{
  const {service,extract,install}=await setup(Buffer.from('damaged update'));
  await service.check();await service.download();expect(service.get().status).toBe('error');
  expect(extract).not.toHaveBeenCalled();await service.install();expect(install).not.toHaveBeenCalled();
});
it('keeps the downloaded app retryable when replacement preparation fails',async()=>{
  const {service,install}=await setup();await service.check();await service.download();
  install.mockRejectedValueOnce(new Error('not writable'));await service.install();
  expect(service.get().status).toBe('downloaded');expect(service.get().message).toContain('교체');
  await service.install();expect(install).toHaveBeenCalledTimes(2);
});
it('rejects untrusted download locations, missing checksums and wrong version assets',()=>{
  expect(readMacRelease(release,releasesUrl).version).toBe('0.2.0');
  const zip=release.assets[1];
  for(const bad of [{...zip,browser_download_url:'https://evil.example/update.zip'},{...zip,digest:null},{...zip,name:'SONO-0.1.0-mac-universal.zip'},{...zip,size:0}])
    expect(()=>readMacRelease({...release,assets:[release.assets[0],bad]},releasesUrl)).toThrow();
});
