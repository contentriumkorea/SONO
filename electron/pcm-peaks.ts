import type { FileHandle } from 'node:fs/promises';

// Bounded PCM reads shared by WAV and AIFF; every channel contributes to each peak.
export async function pcmPeaks(handle:FileHandle,{start,frames,align,channels,bits,float=false,littleEndian=true,unsigned8=false}:{start:number;frames:number;align:number;channels:number;bits:number;float?:boolean;littleEndian?:boolean;unsigned8?:boolean},count:number):Promise<number[]>{
  if(!Number.isInteger(count)||count<1||count>4096)throw new Error('Invalid waveform size');
  const peaks=new Array<number>(count).fill(0);if(!frames)return peaks;
  const width=bits/8,buffer=Buffer.alloc(Math.floor(65536/align)*align);
  let frame=0,position=start;
  while(frame<frames){
    const wanted=Math.min(buffer.length,(frames-frame)*align),{bytesRead}=await handle.read(buffer,0,wanted,position);
    if(bytesRead!==wanted)throw new Error('음원 파일이 변경되었습니다.');
    for(let at=0;at<bytesRead;at+=align,frame++){
      const bucket=Math.min(count-1,Math.floor(frame/frames*count));let max=peaks[bucket];
      for(let channel=0;channel<channels;channel++){
        const index=at+channel*width;
        const value=float?(bits===32?(littleEndian?buffer.readFloatLE(index):buffer.readFloatBE(index)):(littleEndian?buffer.readDoubleLE(index):buffer.readDoubleBE(index))):
          bits===8&&unsigned8?(buffer[index]-128)/128:(littleEndian?buffer.readIntLE(index,width):buffer.readIntBE(index,width))/2**(bits-1);
        if(Number.isFinite(value))max=Math.max(max,Math.min(1,Math.abs(value)));
      }
      peaks[bucket]=max;
    }
    position+=bytesRead;
  }
  return peaks;
}
