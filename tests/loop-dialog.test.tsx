// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { LoopDialog } from '../src/components/LoopDialog';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
afterEach(async()=>{await act(async()=>root.render(null));});
async function edit(label:string,value:string){const input=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);await act(async()=>input.dispatchEvent(new Event('input',{bubbles:true})));}
it('validates A/B and converts visible clip times to absolute source times',async()=>{
  const save=vi.fn();await act(async()=>root.render(<LoopDialog name="Song" bounds={{start:10,end:20}} loop={undefined} getPosition={()=>12} onSave={save} onClear={()=>{}} onClose={()=>{}}/>));
  await edit('A 시작 시간','2.5');await edit('B 종료 시간','6.25');await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(save).toHaveBeenCalledWith({start:12.5,end:16.25});
  await edit('B 종료 시간','1');expect(container.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(save).toHaveBeenCalledTimes(1);
});
it('reads the actual current position for A/B and exposes clear for an active loop',async()=>{
  let position=3;const clear=vi.fn();await act(async()=>root.render(<LoopDialog name="Song" bounds={{start:2,end:10}} loop={{start:3,end:7}} getPosition={()=>position} onSave={()=>{}} onClear={clear} onClose={()=>{}}/>));
  const click=async(text:string)=>act(async()=>Array.from(container.querySelectorAll('button')).find(n=>n.textContent===text)!.click());
  position=4.375;await click('현재 위치를 A로');expect(container.querySelector<HTMLInputElement>('input[aria-label="A 시작 시간"]')!.value).toBe('0:02.375');
  position=8;await click('현재 위치를 B로');expect(container.querySelector<HTMLInputElement>('input[aria-label="B 종료 시간"]')!.value).toBe('0:06');await click('구간 반복 해제');expect(clear).toHaveBeenCalledOnce();
});
