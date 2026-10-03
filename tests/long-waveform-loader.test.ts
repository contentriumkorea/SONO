import { afterEach,expect,it,vi } from 'vitest';
import { loadWaveform } from '../src/waveform';
import type { Track } from '../src/shared/types';
const {decodeStream}=vi.hoisted(()=>({decodeStream:vi.fn(async()=>Array(960).fill(.4))}));
vi.mock('../src/stream-waveform',()=>({decodeStream}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it.each([{size:10*1024**2,duration:7200},{size:200*1024**2,duration:120}])('streams an uncached source despite the old size/duration limits (%o)',async({size,duration})=>{
  const saveWaveform=vi.fn(async()=>{});vi.stubGlobal('window',{luma:{getWaveform:async()=>({key:'key',size,peaks:null}),saveWaveform}});
  const signal=new AbortController().signal;
  await expect(loadWaveform({id:'long',duration} as Track,signal)).resolves.toHaveLength(960);
  expect(decodeStream).toHaveBeenCalledWith('luma://audio/long',duration,signal,undefined);expect(saveWaveform).toHaveBeenCalledWith('long','key',Array(960).fill(.4));
});
it('keeps decoded peaks visible when the disk cache cannot be saved',async()=>{
  vi.stubGlobal('window',{luma:{getWaveform:async()=>({key:'key',size:200*1024**2,peaks:null}),saveWaveform:async()=>{throw new Error('cache permission denied');}}});
  await expect(loadWaveform({id:'cache-error',duration:7200} as Track,new AbortController().signal)).resolves.toHaveLength(960);
});
