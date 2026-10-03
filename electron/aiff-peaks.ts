import { open } from 'node:fs/promises';
import { WAVEFORM_POINTS } from '../src/shared/waveform';
import { pcmPeaks } from './pcm-peaks';

// AIFF/AIFC PCM is not handled by the browser's streaming container decoder.
export async function aiffPeaks(file:string,count=WAVEFORM_POINTS):Promise<number[]|null>{
  const handle=await open(file,'r');
  try{
    const size=(await handle.stat()).size,header=Buffer.alloc(12);
    if((await handle.read(header,0,12,0)).bytesRead!==12||header.toString('ascii',0,4)!=='FORM')return null;
    const type=header.toString('ascii',8,12);if(type!=='AIFF'&&type!=='AIFC')return null;
    const limit=Math.min(size,header.readUInt32BE(4)+8),chunk=Buffer.alloc(8);
    let offset=12,channels=0,frames=0,bits=0,start=0,length=0,compression='NONE',chunks=0;
    while(offset+8<=limit&&chunks++<4096){
      if((await handle.read(chunk,0,8,offset)).bytesRead!==8)return null;
      const name=chunk.toString('ascii',0,4),bytes=chunk.readUInt32BE(4);offset+=8;if(offset+bytes>limit)return null;
      if(name==='COMM'){
        if(bytes<(type==='AIFC'?22:18))return null;
        const comm=Buffer.alloc(Math.min(bytes,22));if((await handle.read(comm,0,comm.length,offset)).bytesRead!==comm.length)return null;
        channels=comm.readUInt16BE(0);frames=comm.readUInt32BE(2);bits=comm.readUInt16BE(6);if(type==='AIFC')compression=comm.toString('ascii',18,22);
      }else if(name==='SSND'){
        if(bytes<8)return null;const sound=Buffer.alloc(8);if((await handle.read(sound,0,8,offset)).bytesRead!==8)return null;
        const skip=sound.readUInt32BE(0);if(skip>bytes-8)return null;start=offset+8+skip;length=bytes-8-skip;
      }
      if(channels&&start)break;offset+=bytes+(bytes%2);
    }
    const float=['fl32','FL32','fl64','FL64'].includes(compression),littleEndian=compression==='sowt',align=channels*bits/8;
    if(!start||channels<1||channels>32||!Number.isInteger(align)||align<1||align>65536||frames*align>length)return null;
    if(float){if(bits!==Number(compression.slice(2)))return null;}
    else if(!['NONE','twos','sowt'].includes(compression)||![8,16,24,32].includes(bits))return null;
    return await pcmPeaks(handle,{start,frames,align,channels,bits,float,littleEndian},count);
  }finally{await handle.close();}
}
