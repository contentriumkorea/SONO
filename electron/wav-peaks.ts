import { open } from 'node:fs/promises';
import { WAVEFORM_POINTS } from '../src/shared/waveform';
import { pcmPeaks } from './pcm-peaks';
// Stream PCM WAV instead of allocating a decoded buffer for long event tracks.
export async function wavPeaks(file:string,count=WAVEFORM_POINTS):Promise<number[]|null>{
  const handle=await open(file,'r');
  try{
    const size=(await handle.stat()).size,header=Buffer.alloc(12);
    if((await handle.read(header,0,12,0)).bytesRead!==12||header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WAVE')return null;
    let offset=12,format=0,channels=0,bits=0,align=0,start=0,length=0;
    const chunk=Buffer.alloc(8);
    let chunks=0;
    while(offset+8<=size&&chunks++<4096){
      if((await handle.read(chunk,0,8,offset)).bytesRead!==8)return null;
      const name=chunk.toString('ascii',0,4),bytes=chunk.readUInt32LE(4);offset+=8;
      if(offset+bytes>size)return null;
      if(name==='fmt '&&bytes>=16){const fmt=Buffer.alloc(Math.min(bytes,40));await handle.read(fmt,0,fmt.length,offset);
        format=fmt.readUInt16LE(0);channels=fmt.readUInt16LE(2);align=fmt.readUInt16LE(12);bits=fmt.readUInt16LE(14);
        if(format===0xfffe&&fmt.length>=40)format=fmt.readUInt16LE(24);
      }else if(name==='data'){start=offset;length=bytes;}
      if(format&&start)break;offset+=bytes+(bytes%2);
    }
    const width=bits/8;
    if(!start||!channels||channels>32||align<channels*width||!align||align>65536||!((format===1&&[8,16,24,32].includes(bits))||(format===3&&[32,64].includes(bits))))return null;
    return await pcmPeaks(handle,{start,frames:Math.floor(length/align),align,channels,bits,float:format===3,unsigned8:format===1&&bits===8},count);
  }finally{await handle.close();}
}
