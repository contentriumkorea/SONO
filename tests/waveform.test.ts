import { expect,it } from 'vitest';
import { audioPeaks } from '../src/shared/waveform';
it('preserves silence, stereo transients and amplitudes in real sample buckets',async()=>{
  const peaks=await audioPeaks([Float32Array.from([0,0,.2,-.3,0,0,0,0]),Float32Array.from([0,0,0,0,0,0,-.8,.4])],4);
  expect(peaks[0]).toBe(0);expect(peaks[1]).toBeCloseTo(.3);expect(peaks[2]).toBe(0);expect(peaks[3]).toBeCloseTo(.8);
});
it('handles short silent audio and cancellation without manufacturing a waveform',async()=>{
  expect(await audioPeaks([new Float32Array(1)],4)).toEqual([0,0,0,0]);
  const controller=new AbortController();controller.abort();
  await expect(audioPeaks([new Float32Array(8000)],4,controller.signal)).rejects.toMatchObject({name:'AbortError'});
});
