import type { AppState, Track, LibraryFolder } from './types';
import { trackDirectory, folderName } from './folders';
import { reorderTrackIds } from './library';
export const songName=(track:Track)=>track.displayName||track.path.replace(/\\/g,'/').split('/').at(-1)!.replace(/\.[^.]+$/,'');
export const songFolder=(track:Track)=>track.folderId||trackDirectory(track.path);
export function libraryFolders(tracks:Track[],stored:LibraryFolder[]=[]):LibraryFolder[]{
  const folders=new Map<string,LibraryFolder>();
  for(const folder of stored)if(folder&&typeof folder.id==='string'&&typeof folder.name==='string'&&!folders.has(folder.id))folders.set(folder.id,{id:folder.id,name:folder.name.trim().slice(0,200)||folderName(folder.id)});
  for(const track of tracks){const id=songFolder(track);if(!folders.has(id))folders.set(id,{id,name:folderName(id)});}
  return [...folders.values()];
}
export function removeEmptyLibraryFolders(state:AppState,ids?:string[]):AppState{
  const used=new Set(state.tracks.map(songFolder));
  return {...state,folders:libraryFolders(state.tracks,state.folders).filter(folder=>used.has(folder.id)||!!ids&&!ids.includes(folder.id))};
}
export function moveSongsToFolder(state:AppState,ids:string[],folderId:string,target?:string,edge:'before'|'after'='after'):AppState{
  const folders=libraryFolders(state.tracks,state.folders);
  if(!folders.some(f=>f.id===folderId)||target&&ids.includes(target))return state;
  const moved=state.tracks.filter(t=>ids.includes(t.id)).map(t=>({...t,folderId}));
  if(!moved.length)return state;
  const remaining=state.tracks.filter(t=>!ids.includes(t.id));
  let index=target?remaining.findIndex(t=>t.id===target):-1;
  if(index>=0)index+=edge==='after'?1:0;
  else {index=remaining.length;for(let i=remaining.length-1;i>=0;i--)if(songFolder(remaining[i])===folderId){index=i+1;break;}}
  remaining.splice(index,0,...moved);
  remaining.sort((a,b)=>folders.findIndex(f=>f.id===songFolder(a))-folders.findIndex(f=>f.id===songFolder(b)));
  const order=remaining.map(t=>t.id),sameScope=state.playback.order.length===state.tracks.length&&state.tracks.every(t=>state.playback.order.includes(t.id));
  return {...state,folders,tracks:remaining,settings:{...state.settings,librarySort:'manual'},playback:sameScope?{...state.playback,order}:state.playback};
}
export function moveLibrarySongs(state:AppState,ids:string[],target:string,edge:'before'|'after'):AppState{
  const track=state.tracks.find(t=>t.id===target);
  return track?moveSongsToFolder(state,ids,songFolder(track),target,edge):state;
}
export function reorderLibraryFolder(state:AppState,from:string,target:string,edge:'before'|'after'):AppState{
  const folders=libraryFolders(state.tracks,state.folders),order=reorderTrackIds(folders.map(f=>f.id),[from],target,edge);
  const sameScope=state.playback.order.length===state.tracks.length&&state.tracks.every(t=>state.playback.order.includes(t.id));
  const playback=sameScope?{...state.playback,order:order.flatMap(id=>state.tracks.filter(t=>songFolder(t)===id).map(t=>t.id))}:state.playback;
  return {...state,playback,folders:order.map(id=>folders.find(f=>f.id===id)!),settings:{...state.settings,librarySort:'manual'}};
}
export function renameLibraryItem(state:AppState,kind:'track'|'folder',id:string,name:string):AppState{
  const clean=name.trim().slice(0,200);if(!clean)return state;
  return kind==='track'?{...state,tracks:state.tracks.map(t=>t.id===id?{...t,displayName:clean}:t)}:{...state,folders:libraryFolders(state.tracks,state.folders).map(f=>f.id===id?{...f,name:clean}:f)};
}
