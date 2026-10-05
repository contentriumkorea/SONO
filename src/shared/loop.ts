export interface LoopRange {start:number;end:number}
export const MIN_LOOP_SECONDS=.1;
export function sanitizeLoop(value:unknown,bounds:LoopRange):LoopRange|undefined{
  if(!value||typeof value!=='object'||!Number.isFinite(bounds.start)||!Number.isFinite(bounds.end))return;
  const raw=value as Partial<LoopRange>;
  if(typeof raw.start!=='number'||typeof raw.end!=='number'||!Number.isFinite(raw.start)||!Number.isFinite(raw.end))return;
  const start=Math.max(bounds.start,Math.min(raw.start,bounds.end)),end=Math.max(bounds.start,Math.min(raw.end,bounds.end));
  if(end-start+1e-9<MIN_LOOP_SECONDS)return;return {start,end};
}
