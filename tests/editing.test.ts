import { expect, it } from 'vitest';
import { emptyState, removeLibraryTracks, reorderTrackIds, sanitizeState } from '../src/shared/library';
import { moveLibrarySongs, reorderLibraryFolder, renameLibraryItem, removeEmptyLibraryFolders, songName, songFolder } from '../src/shared/organization';
const song=(id:string)=>({id,path:`/music/${id}.wav`,title:id,artist:'artist',album:'album',duration:12,format:'WAV',addedAt:1,favorite:false});
it('moves a selected block before or after a target without scrambling hidden IDs',()=>{
  expect(reorderTrackIds(['a','hidden','b','c','d'],['b','c'],'a','before')).toEqual(['b','c','a','hidden','d']);
  expect(reorderTrackIds(['a','b','c','d'],['a'],'c','after')).toEqual(['b','c','a','d']);
  expect(reorderTrackIds(['a','b'],['a'],'a','before')).toEqual(['a','b']);
});
it('moves only the dragged songs into another folder and retains empty folders',()=>{
  const state=sanitizeState({...emptyState(),tracks:[{...song('a'),path:'/one/a.wav'},{...song('b'),path:'/one/b.wav'},{...song('c'),path:'/two/c.wav'}]});
  const result=moveLibrarySongs(state,['a'],'c','after');
  expect(result.tracks.map(t=>t.id)).toEqual(['b','c','a']);
  expect(songFolder(result.tracks.find(t=>t.id==='a')!)).toBe('/two');
  expect(songFolder(result.tracks.find(t=>t.id==='b')!)).toBe('/one');
  expect(result.tracks.find(t=>t.id==='a')!.path).toBe('/one/a.wav');
  const empty=moveLibrarySongs(result,['b'],'c','before');
  expect(empty.folders?.map(f=>f.id)).toContain('/one');
});
it('reorders folders without changing song membership',()=>{
  const state=sanitizeState({...emptyState(),tracks:[{...song('a'),path:'/one/a.wav'},{...song('b'),path:'/two/b.wav'}]});
  const result=reorderLibraryFolder(state,'/two','/one','before');
  expect(result.folders?.map(f=>f.id)).toEqual(['/two','/one']);
  expect(result.tracks.map(songFolder)).toEqual(['/one','/two']);
});
it('shows file names and persists renamed songs and folders without changing paths',()=>{
  const state=sanitizeState({...emptyState(),tracks:[{...song('a'),title:'metadata title',path:'/one/File name.wav'}]});
  expect(songName(state.tracks[0])).toBe('File name');
  const renamed=renameLibraryItem(renameLibraryItem(state,'track','a','New name'),'folder','/one','New folder');
  const saved=sanitizeState(JSON.parse(JSON.stringify(renamed)));
  expect(songName(saved.tracks[0])).toBe('New name');
  expect(saved.folders?.[0].name).toBe('New folder');
  expect(saved.tracks[0].path).toBe('/one/File name.wav');
});
it('removes songs from library, playlists, queue, and current playback together',()=>{
  const state=emptyState();state.tracks=['a','b','c'].map(song);state.playlists=[{id:'p',name:'mix',trackIds:['a','b','c']}];
  state.playback={...state.playback,currentId:'b',anchorId:'b',position:5,queue:['b','c'],order:['a','b','c']};
  const result=removeLibraryTracks(state,['a','b']);
  expect(result.tracks.map(t=>t.id)).toEqual(['c']);expect(result.playlists[0].trackIds).toEqual(['c']);
  expect(result.playback.currentId).toBeNull();expect(result.playback.position).toBe(0);
  expect(result.playback.queue).toEqual(['c']);expect(result.playback.order).toEqual(['c']);
  expect(state.tracks).toHaveLength(3);
});
it('removes empty folder entries when deleting library songs without changing remaining paths',()=>{
  const state=sanitizeState({...emptyState(),tracks:[{...song('a'),path:'/one/a.wav'},{...song('b'),path:'/two/b.wav'}],folders:[{id:'/old',name:'Old empty folder'}]});
  const result=removeLibraryTracks(state,['a']);
  expect(result.folders?.map(f=>f.id)).toEqual(['/two']);
  expect(result.tracks[0].path).toBe('/two/b.wav');
  expect(removeLibraryTracks(result,['b']).folders).toEqual([]);
  expect(state.folders).toHaveLength(3);
});
it('deletes selected empty folders only and never removes a folder with library songs',()=>{
  const state=sanitizeState({...emptyState(),tracks:[song('a')],folders:[{id:'/empty',name:'Empty'},{id:'/other',name:'Other empty'}]});
  const result=removeEmptyLibraryFolders(state,['/empty','/music']);
  expect(result.folders?.map(f=>f.id)).toEqual(['/other','/music']);
  expect(result.tracks).toEqual(state.tracks);
  expect(removeEmptyLibraryFolders(result).folders?.map(f=>f.id)).toEqual(['/music']);
  expect(sanitizeState(JSON.parse(JSON.stringify(result))).folders?.map(f=>f.id)).toEqual(['/other','/music']);
});
