import { expect,it } from 'vitest';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readWaveform } from '../electron/waveforms';

function aiff(compression:string|null,bits:number,channels=1){
  const comm=Buffer.alloc(compression?24:18);comm.writeUInt16BE(channels);comm.writeUInt32BE(4,2);comm.writeUInt16BE(bits,6);comm.writeUInt16BE(0x400b,8);comm.writeUInt16BE(0xfa00,10);
  if(compression)comm.write(compression,18);
  const samples=Buffer.alloc(4*channels*bits/8);
  for(let frame=0;frame<4;frame++)for(let channel=0;channel<channels;channel++){
    const value=[0,.5,-.25,0][frame]*(channel===1?-1:1),at=(frame*channels+channel)*bits/8;
    if(compression==='fl32')samples.writeFloatBE(value,at);
    else if(compression==='fl64')samples.writeDoubleBE(value,at);
    else if(compression==='sowt')samples.writeIntLE(value*2**(bits-1),at,bits/8);
    else samples.writeIntBE(value*2**(bits-1),at,bits/8);
  }
  // SSND offset and odd-sized unknown chunk must be skipped correctly.
  const sound=Buffer.alloc(11);sound.writeUInt32BE(3);
  const chunk=(name:string,b:Buffer)=>{const h=Buffer.alloc(8);h.write(name);h.writeUInt32BE(b.length,4);return Buffer.concat([h,b,...(b.length%2?[Buffer.alloc(1)]:[])]);};
  const body=Buffer.concat([Buffer.from(compression?'AIFC':'AIFF'),chunk('NAME',Buffer.from('x')),chunk('COMM',comm),chunk('SSND',Buffer.concat([sound,samples]))]);
  const header=Buffer.alloc(8);header.write('FORM');header.writeUInt32BE(body.length,4);return Buffer.concat([header,body]);
}
it.each([[null,8,1],[null,16,2],[null,24,1],[null,32,1],['sowt',16,1],['fl32',32,1],['fl64',64,1]] as const)('reads %s %i-bit AIFF PCM without losing stereo peaks',async(compression,bits,channels)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-aiff-'));
  try{
    const file=path.join(dir,'source.aiff');await writeFile(file,aiff(compression,bits,channels));
    const {peaks}=await readWaveform(file,path.join(dir,'cache'));expect(peaks).toHaveLength(960);
    expect(peaks![0]).toBe(0);expect(peaks![240]).toBe(.5);expect(peaks![480]).toBe(.25);expect(peaks![720]).toBe(0);
    expect((await readWaveform(file,path.join(dir,'cache'))).peaks).toEqual(peaks);
  }finally{await rm(dir,{recursive:true,force:true});}
});
it('leaves unsupported AIFF compression to the compatibility decoder',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-aiff-'));
  try{const file=path.join(dir,'source.aif');await writeFile(file,aiff('ulaw',8));expect((await readWaveform(file,path.join(dir,'cache'))).peaks).toBeNull();}
  finally{await rm(dir,{recursive:true,force:true});}
});
