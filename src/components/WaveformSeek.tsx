import { useEffect,useId,useMemo,useState } from 'react';
import type { Track } from '../shared/types';
import { loadWaveform } from '../waveform';
import { trimBounds } from '../shared/trim';
import { trimTime } from '../shared/trim';
import type { LoopRange } from '../shared/loop';

export function WaveformSeek({track,position,duration,onSeek,loop}:{track:Track|null;position:number;duration:number;onSeek:(time:number)=>void;loop?:LoopRange}){
  const [wave,setWave]=useState<{id:string;peaks:number[]|null;status:string}>({id:'',peaks:null,status:''});
  const clip=useId().replace(/:/g,''),total=duration||track?.duration||1,range=trimBounds({duration:total,trim:track?.trim}),percent=Math.max(0,Math.min(100,(position-range.start)/(range.duration||1)*100));
  useEffect(()=>{
    if(!track){setWave({id:'',peaks:null,status:''});return;}
    const controller=new AbortController();setWave({id:track.id,peaks:null,status:'파형 분석 중'});
    void loadWaveform(track,controller.signal,(peaks,percent)=>{if(!controller.signal.aborted)setWave({id:track.id,peaks,status:`파형 분석 중 ${percent}%`});}).then(peaks=>{if(!controller.signal.aborted)setWave({id:track.id,peaks,status:'음원 파형'});})
      .catch(error=>{if(!controller.signal.aborted)setWave({id:track.id,peaks:null,status:error instanceof Error?error.message:'파형을 읽을 수 없습니다.'});});
    return()=>controller.abort();
  },[track?.id,track?.path]);
  const peaks=wave.id===track?.id?wave.peaks:null;
  const bars=useMemo(()=>{
    if(!peaks)return [];const max=Math.max(...peaks,.001),first=range.start/total*peaks.length,length=range.duration/total*peaks.length;
    return Array.from({length:160},(_,i)=>{const from=Math.min(peaks.length-1,Math.floor(first+i*length/160)),to=Math.max(from+1,Math.ceil(first+(i+1)*length/160));
      const amplitude=Math.max(...peaks.slice(from,to),0)/max,height=Math.max(1,amplitude*30);
      return <rect key={i} x={i*4} y={(32-height)/2} width="2.5" height={height} rx="1"/>;});
  },[peaks,range.start,range.duration,total]);
  return <div className={`waveform-seek ${peaks?'has-waveform':''}`} data-waveform-state={peaks&&wave.status==='음원 파형'?'ready':track?'loading-or-unavailable':'empty'} title={wave.id===track?.id?wave.status:''}>
    {peaks?<svg className="waveform-art" viewBox="0 0 640 32" preserveAspectRatio="none" aria-label="음원 파형" role="img">
      <defs><clipPath id={clip}><rect x="0" y="0" width={640*percent/100} height="32"/></clipPath></defs>
      <g className="waveform-remaining">{bars}</g><g className="waveform-played" clipPath={`url(#${clip})`}>{bars}</g>
      <line className="waveform-cursor" x1={640*percent/100} x2={640*percent/100} y1="0" y2="32"/>
    </svg>:<div className="waveform-fallback"><div style={{width:`${percent}%`}}/></div>}
    {loop&&<div className="waveform-loop-region" role="img" aria-label={`구간 반복 A ${trimTime(loop.start-range.start)} B ${trimTime(loop.end-range.start)}`} style={{left:`${(loop.start-range.start)/(range.duration||1)*100}%`,width:`${(loop.end-loop.start)/(range.duration||1)*100}%`}}><span className="loop-label loop-a">A</span><span className="loop-label loop-b">B</span></div>}
    {wave.id===track?.id&&wave.status.startsWith('파형 분석 중')&&<span className="waveform-status" role="status">{wave.status}</span>}
    <input aria-label="재생 위치" type="range" min={range.start} max={range.end} step="0.01" value={Math.max(range.start,Math.min(position,range.end))} disabled={!track} onChange={event=>onSeek(Number(event.target.value))}/>
  </div>;
}
