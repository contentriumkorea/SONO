import { expect,it } from 'vitest';
import { streamPeaks } from '../src/shared/stream-waveform';

function chunk(timestamp:number,channels:number[][],sampleRate=1){return {timestamp,buffer:{sampleRate,length:channels[0].length,numberOfChannels:channels.length,getChannelData:(i:number)=>Float32Array.from(channels[i])}};}
it('maps streamed samples across a long timeline and keeps stereo transients without filling silence',async()=>{
  async function* chunks(){yield chunk(0,[[0,0],[0,0]]);yield chunk(4000,[[.2,0],[.8,0]]);yield chunk(7199,[[.4],[0]]);}
  const peaks=await streamPeaks(chunks(),7200,new AbortController().signal);
  expect(peaks).toHaveLength(960);expect(peaks[0]).toBe(0);expect(peaks[533]).toBeCloseTo(.8);expect(peaks[959]).toBeCloseTo(.4);
  expect(peaks.filter(Boolean)).toHaveLength(2);
});
it('releases the stream on cancellation and never consumes the remaining chunks',async()=>{
  const controller=new AbortController();let closed=false,consumed=0;
  async function* chunks(){try{consumed++;yield chunk(0,[[.3]]);controller.abort();consumed++;yield chunk(10,[[.5]]);consumed++;yield chunk(20,[[.7]]);}finally{closed=true;}}
  await expect(streamPeaks(chunks(),7200,controller.signal)).rejects.toThrow();expect(closed).toBe(true);expect(consumed).toBe(2);
});
