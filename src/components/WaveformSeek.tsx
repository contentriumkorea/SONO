import { useEffect,useId,useMemo,useState } from 'react';
import type { Track } from '../shared/types';
import { loadWaveform } from '../waveform';

export function WaveformSeek({track,position,duration,onSeek}:{track:Track|null;position:number;duration:number;onSeek:(time:number)=>void}){
  const [wave,setWave]=useState<{id:string;peaks:number[]|null;status:string}>({id:'',peaks:null,status:''});
  const clip=useId().replace(/:/g,''),total=duration||track?.duration||1,percent=Math.max(0,Math.min(100,position/total*100));
  useEffect(()=>{
    if(!track){setWave({id:'',peaks:null,status:''});return;}
    const controller=new AbortController();setWave({id:track.id,peaks:null,status:'파형 분석 중'});
    void loadWaveform(track,controller.signal).then(peaks=>{if(!controller.signal.aborted)setWave({id:track.id,peaks,status:'음원 파형'});})
      .catch(error=>{if(!controller.signal.aborted)setWave({id:track.id,peaks:null,status:error instanceof Error?error.message:'파형을 읽을 수 없습니다.'});});
    return()=>controller.abort();
  },[track?.id,track?.path]);
  const peaks=wave.id===track?.id?wave.peaks:null;
  const bars=useMemo(()=>{
    if(!peaks)return [];const max=Math.max(...peaks,.001);
    return Array.from({length:160},(_,i)=>{const from=Math.floor(i*peaks.length/160),to=Math.floor((i+1)*peaks.length/160);
      const amplitude=Math.max(...peaks.slice(from,to),0)/max,height=Math.max(1,amplitude*30);
      return <rect key={i} x={i*4} y={(32-height)/2} width="2.5" height={height} rx="1"/>;});
  },[peaks]);
  return <div className={`waveform-seek ${peaks?'has-waveform':''}`} data-waveform-state={peaks?'ready':track?'loading-or-unavailable':'empty'} title={wave.id===track?.id?wave.status:''}>
    {peaks?<svg className="waveform-art" viewBox="0 0 640 32" preserveAspectRatio="none" aria-label="음원 파형" role="img">
      <defs><clipPath id={clip}><rect x="0" y="0" width={640*percent/100} height="32"/></clipPath></defs>
      <g className="waveform-remaining">{bars}</g><g className="waveform-played" clipPath={`url(#${clip})`}>{bars}</g>
      <line className="waveform-cursor" x1={640*percent/100} x2={640*percent/100} y1="0" y2="32"/>
    </svg>:<div className="waveform-fallback"><div style={{width:`${percent}%`}}/></div>}
    <input aria-label="재생 위치" type="range" min="0" max={total} step="0.1" value={Math.min(position,total)} disabled={!track} onChange={event=>onSeek(Number(event.target.value))}/>
  </div>;
}
