import type { UpdateState } from '../src/shared/types';

export interface NativeUpdater {
  autoDownload:boolean;autoInstallOnAppQuit:boolean;allowPrerelease:boolean;allowDowngrade:boolean;
  on(event:string,listener:(...args:any[])=>void):unknown;
  checkForUpdates():Promise<unknown>;downloadUpdate():Promise<unknown>;
  quitAndInstall(silent:boolean,relaunch:boolean):void|Promise<void>;
}
interface Options {
  version:string;releasesUrl:string;updater?:NativeUpdater;
  readRelease:()=>Promise<{version:string}>;
  flush:()=>Promise<void>;openRelease:(url:string)=>Promise<unknown>;
}
function numbers(version:string){
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('유효한 정식 버전이 아닙니다.');
  return version.split('.').map(Number);
}
export function isNewerVersion(candidate:string,current:string){
  const a=numbers(candidate),b=numbers(current);
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}
  return false;
}
export function readRelease(value:unknown,platform:string,releasesUrl:string):{version:string}{
  const r=value as {tag_name?:string;draft?:boolean;prerelease?:boolean;html_url?:string;assets?:{name:string}[]};
  if(!r||r.draft||r.prerelease||typeof r.tag_name!=='string'||r.html_url!==`${releasesUrl}/tag/${r.tag_name}`)throw new Error('릴리스 정보를 확인할 수 없습니다.');
  const version=r.tag_name.replace(/^v/,'');numbers(version);
  const extension=platform==='darwin'?'.dmg':'.exe';
  if(!Array.isArray(r.assets)||!r.assets.some(a=>typeof a.name==='string'&&a.name.startsWith('SONO-')&&a.name.endsWith(extension)))throw new Error('설치 파일을 준비 중입니다. 잠시 후 다시 확인해주세요.');
  return {version};
}
export function createUpdateService(options:Options){
  const {updater}=options;const subscribers=new Set<(s:UpdateState)=>void>();
  let state:UpdateState={version:options.version,status:'idle',mode:updater?'automatic':'manual',releasesUrl:options.releasesUrl,message:'새 버전이 있는지 확인해보세요.'};
  let checking:Promise<UpdateState>|null=null;let downloading:Promise<UpdateState>|null=null;let installing=false;
  const set=(patch:Partial<UpdateState>)=>{state={...state,...patch};for(const cb of subscribers)cb({...state});};
  const failed=(message='업데이트를 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.')=>set({status:'error',latestVersion:undefined,percent:undefined,message});
  if(updater){
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
    updater.on('update-available',(info:{version:string})=>set({status:'available',latestVersion:info.version,message:'새 버전을 다운로드할 수 있습니다.'}));
    updater.on('update-not-available',()=>set({status:'current',latestVersion:undefined,message:'최신 버전을 사용하고 있습니다.'}));
    updater.on('download-progress',(progress:{percent:number})=>set({status:'downloading',percent:Math.max(0,Math.min(100,Number.isFinite(progress.percent)?progress.percent:0)),message:'업데이트를 다운로드하고 있습니다.'}));
    updater.on('update-downloaded',(info:{version:string})=>set({status:'downloaded',latestVersion:info.version,percent:100,message:'다운로드가 완료되었습니다. 재시작하면 업데이트가 설치됩니다.'}));
    updater.on('error',()=>failed(state.status==='downloading'?'다운로드하지 못했습니다. 다시 확인 후 시도해주세요.':undefined));
  }
  const service={
    get:()=>({...state}),
    subscribe:(cb:(s:UpdateState)=>void)=>{subscribers.add(cb);return()=>{subscribers.delete(cb);};},
    check():Promise<UpdateState>{
      if(checking)return checking;
      if(['downloading','downloaded','installing'].includes(state.status))return Promise.resolve(service.get());
      set({status:'checking',latestVersion:undefined,percent:undefined,message:'새 버전을 확인하고 있습니다.'});
      checking=(async()=>{
        try{
          if(updater)await updater.checkForUpdates();
          else{
            const release=await options.readRelease();
            if(isNewerVersion(release.version,options.version))set({status:'available',latestVersion:release.version,message:'새 버전을 설치 파일 페이지에서 받을 수 있습니다.'});
            else set({status:'current',message:'최신 버전을 사용하고 있습니다.'});
          }
        }catch{failed();}
        return service.get();
      })().finally(()=>{checking=null;});
      return checking;
    },
    download():Promise<UpdateState>{
      if(downloading)return downloading;
      if(state.status!=='available')return Promise.resolve(service.get());
      if(!updater)return options.openRelease(options.releasesUrl).then(()=>service.get()).catch(()=>{failed('설치 파일 페이지를 열지 못했습니다. 다시 시도해주세요.');return service.get();});
      set({status:'downloading',percent:0,message:'업데이트를 다운로드하고 있습니다.'});
      downloading=updater.downloadUpdate().then(()=>service.get()).catch(()=>{failed('다운로드하지 못했습니다. 다시 확인 후 시도해주세요.');return service.get();}).finally(()=>{downloading=null;});
      return downloading;
    },
    async install():Promise<UpdateState>{
      if(!updater||state.status!=='downloaded'||installing)return service.get();
      installing=true;set({status:'installing',message:'설정을 저장하고 재시작합니다.'});
      try{
        try{await options.flush();}catch{set({status:'downloaded',message:'설정을 저장하지 못했습니다. 설치하지 않았습니다. 다시 시도해주세요.'});return service.get();}
        try{await updater.quitAndInstall(false,true);}
        catch(error){set({status:'downloaded',message:`앱을 교체하지 못했습니다. ${error instanceof Error&&/응용프로그램|쓰기 권한/.test(error.message)?error.message:'기존 앱은 유지됩니다. 다시 시도해주세요.'}`});}
      }
      finally{installing=false;}
      return service.get();
    }
  };
  return service;
}
