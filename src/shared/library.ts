import type { AppState, PlaybackState, Repeat, Track } from './types';
import { libraryFolders, songName, removeEmptyLibraryFolders } from './organization';
export const EQ_FREQUENCIES = [31,44,63,88,125,177,250,354,500,707,1000,1414,2000,2828,4000,5657,8000,11314,16000,20000];
export function emptyState(): AppState {
  return { version:1, tracks:[], playlists:[], settings:{volume:0.7,eqEnabled:false,eq:Array(20).fill(0),preamp:0,eqPreset:'Flat'}, playback:{currentId:null,anchorId:null,position:0,queue:[],order:[],repeat:'off',shuffle:false} };
}
export function mergeTracks(existing: Track[], incoming: Track[]): Track[] {
  const result=[...existing]; const indexes=new Map(existing.map((t,i)=>[t.id,i]));
  for(const track of incoming){
    const index=indexes.get(track.id);
    if(index===undefined){indexes.set(track.id,result.length);result.push(track);}
    else if(track.folderRoot&&track.folderRoot!==result[index].folderRoot)result[index]={...result[index],folderRoot:track.folderRoot};
  }
  return result;
}
export function searchTracks(tracks: Track[], query: string): Track[] {
  const q=query.trim().toLocaleLowerCase();
  return tracks.filter(t=>`${songName(t)} ${t.title} ${t.artist} ${t.album}`.toLocaleLowerCase().includes(q));
}
export function reorderTrackIds(order:string[],moving:string[],target:string,position:'before'|'after'):string[]{
  const moved=order.filter(id=>moving.includes(id));
  if(moved.includes(target)||!order.includes(target))return order;
  const remaining=order.filter(id=>!moving.includes(id));
  const index=remaining.indexOf(target)+(position==='after'?1:0);
  remaining.splice(index,0,...moved);return remaining;
}
export function removeLibraryTracks(state:AppState,ids:string[]):AppState {
  const removed=new Set(ids);const currentRemoved=!!state.playback.currentId&&removed.has(state.playback.currentId);
  return sanitizeState(removeEmptyLibraryFolders({...state,tracks:state.tracks.filter(t=>!removed.has(t.id)),playlists:state.playlists.map(p=>({...p,trackIds:p.trackIds.filter(id=>!removed.has(id))})),playback:{...state.playback,position:currentRemoved?0:state.playback.position}}));
}
export function nextTrack(ids: string[], current: string|null, queued: string[], repeat: Repeat, shuffle: boolean, ended: boolean, random = Math.random): {id:string|null;queue:string[]} {
  const queue=queued.filter(id=>ids.includes(id));
  if(ended&&repeat==='stop')return {id:null,queue};
  if(ended&&repeat==='one'&&current&&ids.includes(current))return {id:current,queue};
  if(queue.length) return {id:queue[0],queue:queue.slice(1)};
  if(!ids.length) return {id:null,queue};
  if(shuffle){const choices=ids.filter(id=>id!==current);return {id:choices.length?choices[Math.floor(random()*choices.length)]:ids[0],queue};}
  const index=ids.indexOf(current ?? '');
  return {id:ids[index+1] ?? (repeat==='all'||!ended?ids[0]:null),queue};
}
export function advancePlayback(playback:PlaybackState,validIds:string[],ended:boolean):PlaybackState{
  const queue=playback.queue.filter(id=>validIds.includes(id));
  const anchor=playback.anchorId||playback.currentId;
  if(ended&&playback.repeat==='stop')return {...playback,currentId:null,queue,position:0};
  if(ended&&playback.repeat==='one'&&playback.currentId&&validIds.includes(playback.currentId))return {...playback,queue,position:0};
  if(queue.length)return {...playback,currentId:queue[0],anchorId:anchor,queue:queue.slice(1),position:0};
  const order=(playback.order.length?playback.order:validIds).filter(id=>validIds.includes(id));
  const result=nextTrack(order,anchor,[],playback.repeat,playback.shuffle,ended);
  return {...playback,currentId:result.id,anchorId:result.id,queue:[],position:0};
}
const clamp=(n:unknown,min:number,max:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
export function sanitizeState(value: unknown): AppState {
  const result=emptyState(); if(!value || typeof value!=='object') return result;
  const raw=value as Partial<AppState>;
  if(Array.isArray(raw.tracks)) result.tracks=mergeTracks([],raw.tracks.filter((t):t is Track=>!!t&&typeof t.id==='string'&&typeof t.path==='string'&&typeof t.title==='string').map(t=>({...t,folderRoot:typeof t.folderRoot==='string'?t.folderRoot:undefined,artist:typeof t.artist==='string'?t.artist:'알 수 없는 아티스트',album:typeof t.album==='string'?t.album:'알 수 없는 앨범',duration:clamp(t.duration,0,864000,0),favorite:!!t.favorite})));
  const ids=new Set(result.tracks.map(t=>t.id));
  result.tracks=result.tracks.map(t=>({...t,folderId:typeof t.folderId==='string'?t.folderId:undefined,displayName:typeof t.displayName==='string'?t.displayName.trim().slice(0,200)||undefined:undefined}));
  result.folders=libraryFolders(result.tracks,Array.isArray(raw.folders)?raw.folders:[]);
  const cleanIds=(arr:unknown):string[]=>Array.isArray(arr)?arr.filter((id):id is string=>typeof id==='string'&&ids.has(id)):[];
  if(Array.isArray(raw.playlists)) result.playlists=raw.playlists.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({id:p.id,name:p.name,trackIds:[...new Set(cleanIds(p.trackIds))]}));
  const s=raw.settings;
  if(s) result.settings={volume:clamp(s.volume,0,1,0.7),eqEnabled:!!s.eqEnabled,eq:Array.from({length:20},(_,i)=>clamp(s.eq?.[i],-12,12,0)),preamp:clamp(s.preamp,-12,6,0),eqPreset:typeof s.eqPreset==='string'?s.eqPreset:'사용자 설정',librarySort:['manual','added','title','artist'].includes(s.librarySort||'')?s.librarySort:'added',fadeIn:clamp(s.fadeIn,0,5,0.35),fadeOut:clamp(s.fadeOut,0,5,0.35)};
  const p=raw.playback;
  if(p) result.playback={currentId:p.currentId&&ids.has(p.currentId)?p.currentId:null,anchorId:(p.anchorId||p.currentId)&&ids.has((p.anchorId||p.currentId)! )?(p.anchorId||p.currentId):null,position:clamp(p.position,0,864000,0),queue:cleanIds(p.queue),order:cleanIds(p.order),repeat:['off','all','one','stop'].includes(p.repeat)?p.repeat:'off',shuffle:!!p.shuffle};
  return result;
}
export function formatTime(seconds:number):string { const s=Math.max(0,Math.floor(seconds||0)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
