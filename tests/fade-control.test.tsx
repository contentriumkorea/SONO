// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import { FadeControl } from '../src/components/FadeControl';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
afterEach(async()=>{await act(async()=>root.render(null));});
it('opens direct editing on double click, commits valid seconds, and cancels with Escape',async()=>{
  const change=vi.fn();await act(async()=>root.render(<FadeControl label="페이드 인" value={.35} onChange={change}/>));
  await act(async()=>container.querySelector('button')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
  const input=container.querySelector<HTMLInputElement>('input[type="number"]')!;expect(input).not.toBeNull();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'2.37');await act(async()=>input.dispatchEvent(new Event('input',{bubbles:true})));
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(change).toHaveBeenCalledWith(2.37);
  await act(async()=>container.querySelector('button')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
  await act(async()=>container.querySelector('input[type="number"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(change).toHaveBeenCalledTimes(1);
});
