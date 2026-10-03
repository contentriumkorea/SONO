import { open } from 'node:fs/promises';
import { WAVEFORM_POINTS } from '../src/shared/waveform';
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
    const frames=Math.floor(length/align);if(!frames)return Array(count).fill(0);
    const peaks=new Array<number>(count).fill(0),buffer=Buffer.alloc(Math.floor(65536/align)*align);
    let frame=0,position=start;
    while(frame<frames){
      const wanted=Math.min(buffer.length,(frames-frame)*align),{bytesRead}=await handle.read(buffer,0,wanted,position);
      if(bytesRead!==wanted)throw new Error('음원 파일이 변경되었습니다.');
      for(let at=0;at<bytesRead;at+=align,frame++){
        const bucket=Math.min(count-1,Math.floor(frame/frames*count));let max=peaks[bucket];
        for(let channel=0;channel<channels;channel++){
          const index=at+channel*width;
          const value=format===3?(bits===32?buffer.readFloatLE(index):buffer.readDoubleLE(index)):
            bits===8?(buffer[index]-128)/128:buffer.readIntLE(index,width)/2**(bits-1);
          if(Number.isFinite(value))max=Math.max(max,Math.min(1,Math.abs(value)));
        }
        peaks[bucket]=max;
      }
      position+=bytesRead;
    }
    return peaks;
  }finally{await handle.close();}
}
