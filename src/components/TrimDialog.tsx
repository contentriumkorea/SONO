import { useState } from 'react';
import { Modal } from './Modal';
import { songName } from '../shared/organization';
import { parseTrimTime,trimBounds,trimTime } from '../shared/trim';
import type { Track } from '../shared/types';
export function TrimDialog({track,position,onClose,onSave}:{track:Track;position:number|null;onClose:()=>void;onSave:(range:Track['trim'])=>void}){
  const original=track.duration,initial=trimBounds(track);
  const [startText,setStart]=useState(trimTime(initial.start)),[endText,setEnd]=useState(trimTime(initial.end));
  const start=parseTrimTime(startText),end=parseTrimTime(endText);
  const valid=start!==null&&end!==null&&start>=0&&end<=original&&end-start>=.05;
  return <Modal title="음원 길이 조정" onClose={onClose}>
    <p className="modal-subtitle">{songName(track)} · 원래 길이 {trimTime(original)}<br/>지정한 구간만 재생합니다. 원본 파일은 유지됩니다.</p>
    <form onSubmit={event=>{event.preventDefault();if(valid)onSave(start===0&&end===original?undefined:{start:start!,end:end!});}}>
      <div className="trim-preview" aria-hidden="true"><span style={{left:`${original?(start??0)/original*100:0}%`,right:`${original?100-(end??original)/original*100:0}%`}}/></div>
      <div className="trim-fields"><label>시작 시간<input aria-label="시작 시간" className="name-input" inputMode="decimal" value={startText} onChange={event=>setStart(event.target.value)}/></label><label>종료 시간<input aria-label="종료 시간" className="name-input" inputMode="decimal" value={endText} onChange={event=>setEnd(event.target.value)}/></label></div>
      <label className="trim-slider">시작 지점<input aria-label="시작 지점" type="range" min="0" max={Math.max(0,(end??original)-.05)} step="0.01" value={Math.min(start??0,Math.max(0,(end??original)-.05))} onChange={event=>setStart(trimTime(Number(event.target.value)))}/></label>
      <label className="trim-slider">종료 지점<input aria-label="종료 지점" type="range" min={Math.min(original,(start??0)+.05)} max={original} step="0.01" value={Math.max(end??original,Math.min(original,(start??0)+.05))} onChange={event=>setEnd(trimTime(Number(event.target.value)))}/></label>
      <div className="trim-position-actions"><button type="button" className="text-button" disabled={position===null} onClick={()=>setStart(trimTime(position??0))}>현재 위치를 시작으로</button><button type="button" className="text-button" disabled={position===null} onClick={()=>setEnd(trimTime(position??original))}>현재 위치를 종료로</button></div>
      <p className={`trim-length ${valid?'':'invalid'}`} role="status">{valid?`조정한 길이 ${trimTime(end!-start!)}`:'종료 시간은 시작 시간보다 뒤여야 하며, 원래 길이를 넘을 수 없습니다.'}</p>
      <p className="hint">시간 입력: 1:30.5 또는 90.5 · 구간 끝에서 다음 곡·반복·정지 설정이 적용됩니다.</p>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={()=>{setStart('0:00');setEnd(trimTime(original));}}>원래 길이</button><button type="button" className="button secondary" onClick={onClose}>취소</button><button type="submit" className="button primary" disabled={!valid}>적용</button></div>
    </form>
  </Modal>;
}
