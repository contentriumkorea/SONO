export const WAVEFORM_POINTS=960;
export async function audioPeaks(channels:Float32Array[],count=WAVEFORM_POINTS,signal?:AbortSignal):Promise<number[]>{
  if(!Number.isInteger(count)||count<1||count>4096)throw new Error('Invalid waveform size');
  const length=channels[0]?.length||0,peaks=new Array<number>(count).fill(0);
  for(let bucket=0;bucket<count;bucket++){
    signal?.throwIfAborted();let max=0;
    const from=Math.floor(bucket*length/count),to=Math.floor((bucket+1)*length/count);
    for(const channel of channels)for(let i=from;i<to;i++){const value=Math.abs(channel[i]||0);if(Number.isFinite(value))max=Math.max(max,value);}
    peaks[bucket]=Math.min(1,max);
    if(bucket%24===23)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return peaks;
}
