// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { UpdatePanel } from '../src/components/UpdatePanel';
import type { UpdateState } from '../src/shared/types';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
afterEach(async()=>{await act(async()=>root.render(null));});
it('one update click downloads and applies the app update in order',async()=>{
  const state:UpdateState={version:'0.1.3',latestVersion:'0.1.4',status:'available',mode:'automatic',releasesUrl:'https://github.com/contentriumkorea/SONO/releases',message:'새 버전'};
  const order:string[]=[];
  const download=vi.fn(async()=>{order.push('download');return {...state,status:'downloaded',percent:100} as UpdateState;});
  const install=vi.fn(async()=>{order.push('install');return {...state,status:'installing'} as UpdateState;});
  window.luma={downloadUpdate:download,installUpdate:install} as unknown as typeof window.luma;
  await act(async()=>root.render(<UpdatePanel state={state} onChange={()=>{}}/>));
  const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='지금 업데이트')!;
  await act(async()=>button.click());expect(order).toEqual(['download','install']);expect(install).toHaveBeenCalledTimes(1);
});
it('does not replace the app if its download failed',async()=>{
  const state:UpdateState={version:'0.1.3',status:'available',mode:'automatic',releasesUrl:'https://github.com/contentriumkorea/SONO/releases',message:'새 버전'};
  const install=vi.fn();window.luma={downloadUpdate:async()=>({...state,status:'error'}),installUpdate:install} as unknown as typeof window.luma;
  await act(async()=>root.render(<UpdatePanel state={state} onChange={()=>{}}/>));
  await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='지금 업데이트')!.click());
  expect(install).not.toHaveBeenCalled();
});
