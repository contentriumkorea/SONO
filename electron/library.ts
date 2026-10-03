import { stat, readdir, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBlob } from 'music-metadata';
import type { Track } from '../src/shared/types';
import { sanitizeTrim } from '../src/shared/trim';
export const AUDIO_EXTENSIONS=['mp3','wav','flac','m4a','aac','ogg','opus','aiff','aif'];
export async function scanMusic(inputs:string[],onError?:(file:string,error:unknown)=>void):Promise<string[]> {
  const files:string[]=[];const seen=new Set<string>();
  async function visit(input:string){
    try{
    const resolved=await realpath(input);if(seen.has(resolved))return;seen.add(resolved);
    const info=await stat(resolved);
    if(info.isDirectory()){
      for(const child of await readdir(resolved,{withFileTypes:true})){
        if(child.isSymbolicLink()||child.name.startsWith('.'))continue;
        if(child.isDirectory()||AUDIO_EXTENSIONS.includes(path.extname(child.name).slice(1).toLowerCase())) await visit(path.join(resolved,child.name));
      }
    }else if(AUDIO_EXTENSIONS.includes(path.extname(resolved).slice(1).toLowerCase()))files.push(resolved);
    }catch(error){onError?.(input,error);}
  }
  for(const input of inputs) await visit(input);
  return files.sort((a,b)=>a.localeCompare(b));
}
export async function readTrack(input:string,artDir?:string):Promise<Track>{
  const file=await realpath(input);
  const id=createHash('sha256').update(process.platform==='win32'?file.toLowerCase():file).digest('hex');
  // File-backed Blob keeps random access without letting a misleading extension
  // force the wrong parser or reading a long file into memory.
  const blob=await openAsBlob(file),metadata=await parseBlob(blob,{duration:true});
  const {common,format}=metadata;
  let artwork:string|undefined;
  const picture=common.picture?.[0];
  if(picture && picture.data.length<5_000_000 && ['image/jpeg','image/png','image/webp'].includes(picture.format)){
    if(artDir){
      const artId=createHash('sha256').update(picture.data).digest('hex');
      await mkdir(artDir,{recursive:true});await writeFile(path.join(artDir,artId),picture.data);
      artwork=`luma://art/${artId}`;
    }else artwork=`data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
  }
  return {id,path:file,title:common.title||path.basename(file,path.extname(file)),artist:common.artist||'알 수 없는 아티스트',album:common.album||'알 수 없는 앨범',duration:format.duration||0,format:await hasMp4Header(blob)?'M4A':path.extname(file).slice(1).toUpperCase(),addedAt:Date.now(),favorite:false,artwork,trackNumber:common.track.no??undefined,sampleRate:format.sampleRate,bitrate:format.bitrate};
}
async function hasMp4Header(blob:Blob){
  const header=Buffer.from(await blob.slice(0,12).arrayBuffer());
  return header.length===12&&header.toString('ascii',4,8)==='ftyp';
}
// Repair affected existing entries on startup so users need not remove/reimport.
// Only inspect 12 bytes of other files; preserve inaccessible sources and edits.
export async function repairMp4Metadata(tracks:Track[]):Promise<boolean>{
  let changed=false;
  for(const track of tracks){
    if(track.format==='M4A')continue;
    try{
      const blob=await openAsBlob(track.path);if(!await hasMp4Header(blob))continue;
      const {format}=await parseBlob(blob,{duration:true});
      if(!format.duration||!Number.isFinite(format.duration))continue;
      track.duration=format.duration;track.format='M4A';track.sampleRate=format.sampleRate;track.bitrate=format.bitrate;
      track.trim=sanitizeTrim(track.trim,track.duration);changed=true;
    }catch{ /* Offline or unreadable files must not prevent the library opening. */ }
  }
  return changed;
}
export function parseM3U(content:string,playlistFile:string):string[]{
  return content.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&!/^https?:/i.test(line)).map(line=>{
    if(line.startsWith('file:'))return fileURLToPath(line);
    return path.resolve(path.dirname(playlistFile),line);
  });
}
