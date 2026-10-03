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

it('returns native PCM peaks even when the cache directory cannot be created',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-cache-'));
  try{
    const file=path.join(dir,'real.wav'),cache=path.join(dir,'blocked'),b=Buffer.alloc(52);
    b.write('RIFF');b.writeUInt32LE(44,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(8,40);
    [0,16384,-8192,0].forEach((v,i)=>b.writeInt16LE(v,44+i*2));await writeFile(file,b);await writeFile(cache,'blocks mkdir');
    const info=await readWaveform(file,cache);expect(info.peaks).toHaveLength(960);expect(Math.max(...info.peaks!)).toBe(.5);
  }finally{await rm(dir,{recursive:true,force:true});}
});
