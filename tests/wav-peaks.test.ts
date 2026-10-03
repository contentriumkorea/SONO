import { expect,it } from 'vitest';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { wavPeaks } from '../electron/wav-peaks';
it('reads real PCM samples in file order with bounded chunks and ignores non-WAV data',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-pcm-'));
  try{
    const file=path.join(dir,'real.wav'),b=Buffer.alloc(52);b.write('RIFF');b.writeUInt32LE(44,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
    b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(8,40);
    [0,16384,-8192,0].forEach((v,i)=>b.writeInt16LE(v,44+i*2));await writeFile(file,b);
    expect(await wavPeaks(file,4)).toEqual([0,.5,.25,0]);
    await writeFile(file,'not a wave');expect(await wavPeaks(file,4)).toBeNull();
  }finally{await rm(dir,{recursive:true,force:true});}
});
