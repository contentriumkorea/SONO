import { ALL_FORMATS,AudioBufferSink,Input,UrlSource } from 'mediabunny';
import { streamPeaks } from './shared/stream-waveform';

export async function decodeStream(url:string,duration:number,signal:AbortSignal,onProgress?:(peaks:number[],percent:number)=>void):Promise<number[]>{
  signal.throwIfAborted();
  const input=new Input({formats:ALL_FORMATS,source:new UrlSource(url,{maxCacheSize:8*1024**2,parallelism:1,getRetryDelay:()=>null,handleUnhandledError:()=>{}})});
  const dispose=()=>input.dispose();signal.addEventListener('abort',dispose,{once:true});
  try{
    const track=await input.getPrimaryAudioTrack();signal.throwIfAborted();
    if(!track||!await track.canDecode())throw new Error('이 음원 형식의 파형을 읽을 수 없습니다.');
    // Imported metadata can be stale or come from an incorrectly named source.
    // Bucket by the actual packet timeline, not a previously stored duration.
    let total:number;
    try{total=await track.computeDuration();}catch(error){signal.throwIfAborted();if(!(duration>0&&Number.isFinite(duration)))throw error;total=duration;}
    signal.throwIfAborted();
    return await streamPeaks(new AudioBufferSink(track).buffers(),total,signal,onProgress);
  }finally{signal.removeEventListener('abort',dispose);dispose();}
}
