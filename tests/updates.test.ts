import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { createUpdateService, readRelease } from '../electron/updates';

const releasesUrl='https://github.com/contentriumkorea/SONO/releases';
class Updater extends EventEmitter {
  autoDownload=true;autoInstallOnAppQuit=true;allowPrerelease=true;allowDowngrade=true;
  checkForUpdates=vi.fn(async()=>{this.emit('update-available',{version:'0.2.0'});});
  downloadUpdate=vi.fn(async()=>{this.emit('download-progress',{percent:42});this.emit('update-downloaded',{version:'0.2.0'});});
  quitAndInstall=vi.fn();
}
function setup(native=true){
  const updater=new Updater();const flush=vi.fn(async()=>{});const open=vi.fn(async()=>{});
  const read=vi.fn(async()=>({version:'0.2.0'}));
  const service=createUpdateService({version:'0.1.0',releasesUrl,updater:native?updater:undefined,readRelease:read,flush,openRelease:open});
  return {service,updater,flush,open,read};
}
it('checks once on duplicate clicks and requires explicit download and installation',async()=>{
  const {service,updater}=setup();let done!:()=>void;
  updater.checkForUpdates.mockImplementationOnce(()=>new Promise(resolve=>{done=()=>{updater.emit('update-available',{version:'0.2.0'});resolve();};}));
  const first=service.check();const second=service.check();
  expect(service.get().status).toBe('checking');expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  done();await Promise.all([first,second]);
  expect(service.get()).toMatchObject({status:'available',latestVersion:'0.2.0',mode:'automatic'});
  expect(updater.autoDownload).toBe(false);expect(updater.autoInstallOnAppQuit).toBe(false);
  expect(updater.allowPrerelease).toBe(false);expect(updater.allowDowngrade).toBe(false);
  expect(updater.downloadUpdate).not.toHaveBeenCalled();expect(updater.quitAndInstall).not.toHaveBeenCalled();
});
it('reports download progress, keeps the downloaded update on recheck, and flushes before installation',async()=>{
  const {service,updater,flush}=setup();const statuses:string[]=[];service.subscribe(s=>statuses.push(s.status));
  await service.check();await service.download();expect(statuses).toContain('downloading');
  expect(service.get()).toMatchObject({status:'downloaded',percent:100});
  await service.check();expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  updater.quitAndInstall.mockImplementation(()=>{expect(flush).toHaveBeenCalledTimes(1);});
  await service.install();expect(updater.quitAndInstall).toHaveBeenCalledWith(false,true);
});
it('does not install if final settings cannot be saved and allows retry',async()=>{
  const {service,updater,flush}=setup();await service.check();await service.download();
  flush.mockRejectedValueOnce(new Error('disk full'));await service.install();
  expect(updater.quitAndInstall).not.toHaveBeenCalled();expect(service.get().status).toBe('downloaded');
  expect(service.get().message).toContain('저장');await service.install();expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
});
it('rejects download and install requests before checking availability',async()=>{
  const {service,updater}=setup();await service.download();await service.install();
  expect(updater.downloadUpdate).not.toHaveBeenCalled();expect(updater.quitAndInstall).not.toHaveBeenCalled();
});
it('keeps failures recoverable, clears stale release details and can recheck',async()=>{
  const {service,updater}=setup();updater.checkForUpdates.mockRejectedValueOnce(new Error('network'));
  await service.check();expect(service.get()).toMatchObject({status:'error',latestVersion:undefined});
  await service.check();expect(service.get().status).toBe('available');
  updater.downloadUpdate.mockRejectedValueOnce(new Error('checksum mismatch'));await service.download();
  expect(service.get().status).toBe('error');expect(updater.quitAndInstall).not.toHaveBeenCalled();
  await service.check();await service.download();expect(service.get().status).toBe('downloaded');
});
it('manual Mac/dev builds check versions and open the fixed release URL',async()=>{
  const {service,read,open,updater}=setup(false);await service.check();
  expect(read).toHaveBeenCalledTimes(1);expect(service.get()).toMatchObject({status:'available',mode:'manual'});
  await service.download();expect(open).toHaveBeenCalledWith(releasesUrl);expect(updater.downloadUpdate).not.toHaveBeenCalled();
  read.mockResolvedValueOnce({version:'0.1.0'});await service.check();expect(service.get().status).toBe('current');
  read.mockResolvedValueOnce({version:'0.0.9'});await service.check();expect(service.get().status).toBe('current');
});
it('validates GitHub releases, missing installers and stable semver rather than lexicographic order',async()=>{
  const release={tag_name:'v0.10.0',draft:false,prerelease:false,html_url:`${releasesUrl}/tag/v0.10.0`,assets:[{name:'SONO-0.10.0-mac-universal.dmg'}]};
  expect(readRelease(release,'darwin',releasesUrl)).toEqual({version:'0.10.0'});
  expect(()=>readRelease({...release,prerelease:true},'darwin',releasesUrl)).toThrow();
  expect(()=>readRelease({...release,html_url:'https://evil.example/'},'darwin',releasesUrl)).toThrow();
  expect(()=>readRelease({...release,assets:[]},'darwin',releasesUrl)).toThrow();
  expect(()=>readRelease({...release,tag_name:'v0.2.0-beta.1'},'darwin',releasesUrl)).toThrow();
  const {service,read}=setup(false);read.mockResolvedValueOnce({version:'0.10.0'});await service.check();expect(service.get().status).toBe('available');
});
