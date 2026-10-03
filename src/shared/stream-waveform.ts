import { WAVEFORM_POINTS } from './waveform';
type AudioChunk={timestamp:number;buffer:Pick<AudioBuffer,'length'|'numberOfChannels'|'sampleRate'|'getChannelData'>};
// Retain only the current decoded chunk and the fixed-size peak array.
export async function streamPeaks(chunks:AsyncIterable<AudioChunk>,duration:number,signal:AbortSignal,onProgress?:(peaks:number[],percent:number)=>void):Promise<number[]>{
  if(!Number.isFinite(duration)||duration<=0)throw new Error('음원 길이를 읽을 수 없습니다.');
  signal.throwIfAborted();const peaks=Array<number>(WAVEFORM_POINTS).fill(0);let lastYield=performance.now(),samples=0;
  for await(const {timestamp,buffer} of chunks){
    signal.throwIfAborted();const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for(let i=0;i<buffer.length;i++){
      const time=timestamp+i/buffer.sampleRate;if(time<0)continue;
      const bucket=Math.min(WAVEFORM_POINTS-1,Math.floor(time/duration*WAVEFORM_POINTS));
      let peak=peaks[bucket];for(const channel of channels){const value=Math.abs(channel[i]);if(Number.isFinite(value))peak=Math.max(peak,Math.min(1,value));}peaks[bucket]=peak;
    }
    samples+=buffer.length;
    if(performance.now()-lastYield>100){
      onProgress?.([...peaks],Math.min(99,Math.floor((timestamp+buffer.length/buffer.sampleRate)/duration*100)));
      await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();lastYield=performance.now();
    }
  }
  signal.throwIfAborted();if(!samples)throw new Error('음원 파형을 읽을 수 없습니다.');return peaks;
}
