import type { Track } from './shared/types';
import { audioPeaks } from './shared/waveform';
// Serialize decoding so rapidly changing songs cannot allocate several full buffers.
let pending:Promise<unknown>=Promise.resolve();
export function loadWaveform(track:Track,signal:AbortSignal):Promise<number[]>{
  const task=pending.catch(()=>{}).then(async()=>{
    signal.throwIfAborted();const info=await window.luma.getWaveform(track.id);signal.throwIfAborted();
    if(info.peaks)return info.peaks;
    if(info.size>128*1024**2||track.duration>3600)throw new Error('큰 음원은 파형 대신 기본 재생바를 표시합니다.');
    const response=await fetch(`luma://audio/${track.id}`,{signal});if(!response.ok)throw new Error('음원을 읽을 수 없습니다.');
    const bytes=await response.arrayBuffer();signal.throwIfAborted();
    if(bytes.byteLength>128*1024**2)throw new Error('음원이 너무 큽니다.');
    const context=new OfflineAudioContext(1,1,11025),buffer=await context.decodeAudioData(bytes);signal.throwIfAborted();
    const peaks=await audioPeaks(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),undefined,signal);
    signal.throwIfAborted();await window.luma.saveWaveform(track.id,info.key,peaks);return peaks;
  });
  pending=task;return task;
}
