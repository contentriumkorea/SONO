import { useState } from 'react';
import { Modal } from './Modal';
import { MIN_LOOP_SECONDS,sanitizeLoop } from '../shared/loop';
import type { LoopRange } from '../shared/loop';
import { parseTrimTime,trimTime } from '../shared/trim';

export function LoopDialog({name,bounds,loop,getPosition,onSave,onClear,onClose}:{name:string;bounds:LoopRange;loop:LoopRange|undefined;getPosition:()=>number;onSave:(range:LoopRange)=>void;onClear:()=>void;onClose:()=>void}){
  const length=bounds.end-bounds.start;
  const [a,setA]=useState(()=>trimTime((loop?.start??Math.min(bounds.end-MIN_LOOP_SECONDS,Math.max(bounds.start,getPosition())))-bounds.start));
  const [b,setB]=useState(()=>trimTime((loop?.end??bounds.end)-bounds.start));
  const start=parseTrimTime(a),end=parseTrimTime(b);
  const range=start!==null&&end!==null?sanitizeLoop({start:bounds.start+start,end:bounds.start+end},bounds):undefined;
  const valid=!!range&&start!==null&&end!==null&&start>=0&&end<=length+.0005;
  const current=()=>trimTime(Math.min(length,Math.max(0,getPosition()-bounds.start)));
  return <Modal title="구간 반복 (A–B)" onClose={onClose}>
    <p className="modal-subtitle">{name} · 재생 가능한 길이 {trimTime(length)}<br/>B에 도달하면 A로 돌아가 계속 반복합니다.</p>
    <form onSubmit={event=>{event.preventDefault();if(valid)onSave(range!);}}>
      <div className="trim-preview loop-preview" aria-hidden="true"><span style={{left:`${Math.max(0,Math.min(100,(start??0)/length*100))}%`,right:`${100-Math.max(0,Math.min(100,(end??length)/length*100))}%`}}/></div>
      <div className="trim-fields"><label>A · 시작<input aria-label="A 시작 시간" className="name-input" inputMode="decimal" value={a} onChange={event=>setA(event.target.value)}/></label><label>B · 종료<input aria-label="B 종료 시간" className="name-input" inputMode="decimal" value={b} onChange={event=>setB(event.target.value)}/></label></div>
      <div className="trim-position-actions"><button type="button" className="text-button" onClick={()=>setA(current())}>현재 위치를 A로</button><button type="button" className="text-button" onClick={()=>setB(current())}>현재 위치를 B로</button></div>
      <p className={`trim-length ${valid?'':'invalid'}`} role="status">{valid?`반복 길이 ${trimTime(range!.end-range!.start)}`:'A와 B를 재생 범위 안에서 0.1초 이상 간격으로 지정해주세요.'}</p>
      <p className="hint">시간 입력: 1:30.5 또는 90.5 · 일시정지 상태는 유지됩니다.<br/>다른 곡으로 이동하거나 음원 길이를 바꾸면 구간 반복이 해제됩니다.</p>
      <div className="dialog-actions">{loop&&<button type="button" className="button secondary" onClick={onClear}>구간 반복 해제</button>}<button type="button" className="button secondary" onClick={onClose}>취소</button><button type="submit" className="button primary" disabled={!valid}>적용</button></div>
    </form>
  </Modal>;
}
