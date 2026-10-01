import { expect, it } from 'vitest';
import { createExitFlusher } from '../electron/lifecycle';
it('exit waits for final renderer state and the newest pending disk write',async()=>{
  const events:string[]=[];let release!:()=>void;let pending=Promise.resolve();
  const renderer=new Promise<void>(resolve=>{release=resolve;});
  const flush=createExitFlusher(async()=>{events.push('request');await renderer;pending=new Promise(resolve=>setTimeout(()=>{events.push('saved');resolve();},5));},()=>pending);
  const first=flush().then(()=>events.push('exit'));
  const second=flush();
  await Promise.resolve();expect(events).toEqual(['request']);
  release();await Promise.all([first,second]);expect(events).toEqual(['request','saved','exit']);
});
