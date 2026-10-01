import { Download, RefreshCw, RotateCcw } from 'lucide-react';
import type { UpdateState } from '../shared/types';

export function UpdatePanel({state,onChange}:{state:UpdateState|null;onChange:(s:UpdateState)=>void}){
  const busy=!!state&&['checking','downloading','installing'].includes(state.status);
  async function run(action:()=>Promise<UpdateState>){
    try{onChange(await action());}catch{if(state)onChange({...state,status:'error',message:'업데이트 요청을 처리하지 못했습니다. 다시 시도해주세요.'});}
  }
  return <div className="update-panel">
    <div className="update-version"><span>현재 버전</span><strong>{state?`v${state.version}`:'확인 중'}</strong></div>
    {state?.latestVersion&&<div className="update-version"><span>새 버전</span><strong>v{state.latestVersion}</strong></div>}
    <p className="update-message" role="status">{state?.message||'업데이트 정보를 불러오고 있습니다.'}</p>
    {state?.status==='downloading'&&<div className="update-progress"><progress aria-label="업데이트 다운로드 진행률" max="100" value={state.percent??0}/><span>{Math.floor(state.percent??0)}%</span></div>}
    <div className="update-actions">
      {state?.status==='available'&&<button className="button primary full" disabled={busy} onClick={()=>run(()=>window.luma.downloadUpdate())}><Download size={16}/>{state.mode==='automatic'?'업데이트 다운로드':'설치 파일 받기'}</button>}
      {state?.status==='downloaded'&&<button className="button primary full" onClick={()=>run(()=>window.luma.installUpdate())}><RotateCcw size={16}/>재시작하여 설치</button>}
      <button className="button secondary full" disabled={!state||busy||state.status==='downloaded'} onClick={()=>run(()=>window.luma.checkForUpdates())}><RefreshCw size={16} className={state?.status==='checking'?'update-spinning':''}/>{state?.status==='checking'?'업데이트 확인 중':'업데이트 확인'}</button>
    </div>
    <p className="hint">{state?.mode==='manual'?'새 버전은 GitHub에서 설치 파일을 받아 교체해주세요. 보관함과 설정은 유지됩니다.':'다운로드 후 설치 버튼을 누르면 설정을 저장하고 앱을 재시작합니다.'}</p>
  </div>;
}
