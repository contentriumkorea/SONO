import { expect,it } from 'vitest';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readWaveform,writeWaveform } from '../electron/waveforms';
it('caches actual peaks on disk, rejects invalid values, and invalidates replaced audio',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-wave-'));
  try{
    const file=path.join(dir,'song.wav');await writeFile(file,'original');
    const first=await readWaveform(file,dir);expect(first.peaks).toBeNull();
    const peaks=Array(960).fill(.4);await writeWaveform(file,dir,first.key,peaks);
    expect((await readWaveform(file,dir)).peaks).toEqual(peaks);
    await expect(writeWaveform(file,dir,first.key,[NaN])).rejects.toThrow();
    await writeFile(file,'replacement audio');const second=await readWaveform(file,dir);
    expect(second.key).not.toBe(first.key);expect(second.peaks).toBeNull();
    await expect(writeWaveform(file,dir,first.key,peaks)).rejects.toThrow();
  }finally{await rm(dir,{recursive:true,force:true});}
});
