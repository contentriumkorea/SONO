import type { AppState } from './types';
import { libraryFolders,moveSongsToFolder,songFolder } from './organization';
export interface ImportDestination {folderId?:string;trackId?:string;edge?:'before'|'after';playlistId?:string;displayIds?:string[];folderOrder?:string[]}
export function placeImportedSongs(state:AppState,ids:string[],target:ImportDestination):AppState{
  const known=new Set(state.tracks.map(t=>t.id)),moving=[...new Set(ids)].filter(id=>known.has(id));
  if(!moving.length)return state;
  const followsVisible=!!state.playback.order.length&&state.playback.order.length===target.displayIds?.length&&state.playback.order.every(id=>target.displayIds!.includes(id));
  const arrange=(order:string[])=>{
    const displayed=(target.displayIds||[]).filter(id=>order.includes(id));let index=0;
    return order.map(id=>displayed.includes(id)?displayed[index++]:id);
  };
  if(target.playlistId){
    const list=state.playlists.find(p=>p.id===target.playlistId);if(!list)return state;
    if(target.trackId&&moving.includes(target.trackId))return state;
    const order=arrange(list.trackIds).filter(id=>!moving.includes(id));let index=target.trackId?order.indexOf(target.trackId):-1;
    if(index<0)index=order.length;else if(target.edge==='after')index++;
    order.splice(index,0,...moving);
    return {...state,playback:followsVisible?{...state.playback,order}:state.playback,settings:{...state.settings,librarySort:'manual'},playlists:state.playlists.map(p=>p.id===list.id?{...p,trackIds:order}:p)};
  }
  const anchorTrack=state.tracks.find(t=>t.id===target.trackId);
  const folder=target.folderId||(anchorTrack?songFolder(anchorTrack):undefined);
  if(!folder)return state;
  const byId=new Map(state.tracks.map(t=>[t.id,t])),allFolders=libraryFolders(state.tracks,state.folders);
  const folderIds=[...new Set([...(target.folderOrder||[]),...allFolders.map(f=>f.id)])];
  const folders=folderIds.flatMap(id=>{const f=allFolders.find(f=>f.id===id);return f?[f]:[];});
  const arranged={...state,folders,tracks:arrange(state.tracks.map(t=>t.id)).map(id=>byId.get(id)!)};
  // A folder header inserts at its beginning; a song uses the visible before/after edge.
  const anchor=target.trackId||arranged.tracks.find(t=>songFolder(t)===folder&&!moving.includes(t.id))?.id;
  const result=moveSongsToFolder(arranged,moving,folder,anchor,target.trackId?target.edge||'before':'before');
  if(target.folderOrder)result.folders=result.folders?.filter(f=>target.folderOrder!.includes(f.id)||result.tracks.some(t=>songFolder(t)===f.id));
  if(followsVisible)result.playback={...result.playback,order:result.tracks.filter(t=>target.displayIds!.includes(t.id)||moving.includes(t.id)).map(t=>t.id)};
  return result;
}
