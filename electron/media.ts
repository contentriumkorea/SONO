import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
export function parseRange(header:string,size:number):{start:number;end:number}|null{
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2])||size<=0)return null;
  const suffix=!match[1];
  const start=suffix?Math.max(0,size-Number(match[2])):Number(match[1]);
  const end=suffix||!match[2]?size-1:Math.min(size-1,Number(match[2]));
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end||(suffix&&Number(match[2])<=0))return null;
  return {start,end};
}
export async function fileResponse(file:string,request:Request,mime:string):Promise<Response>{
  try{
    const info=await stat(file);
    const headers:Record<string,string>={'Content-Type':mime,'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*'};
    const range=request.headers.get('range');
    if(range){
      const bounds=parseRange(range,info.size);
      if(!bounds)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${info.size}`}});
      headers['Content-Range']=`bytes ${bounds.start}-${bounds.end}/${info.size}`;
      headers['Content-Length']=String(bounds.end-bounds.start+1);
      return new Response(Readable.toWeb(createReadStream(file,bounds)) as ReadableStream,{status:206,headers});
    }
    headers['Content-Length']=String(info.size);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream,{headers});
  }catch{return new Response('파일을 찾을 수 없습니다.',{status:404});}
}
