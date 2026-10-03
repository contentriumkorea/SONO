import { expect,it } from 'vitest';
import { emptyState,sanitizeState } from '../src/shared/library';
import { placeImportedSongs } from '../src/shared/placement';
import { songFolder } from '../src/shared/organization';
const song=(id:string,folder='/music')=>({id,path:`${folder}/${id}.wav`,title:id,artist:'',album:'',duration:12,format:'WAV',addedAt:1,favorite:false});
it('inserts several imported songs at the displayed edge in the chosen folder without moving originals',()=>{
  const state=sanitizeState({...emptyState(),tracks:[song('a'),song('b'),song('new1','/outside'),song('new2','/outside')]});
  state.playback={...state.playback,currentId:'a',position:3.4,order:['a','b']};
  const result=placeImportedSongs(state,['new1','new2'],{trackId:'a',edge:'after',displayIds:['b','a'],folderOrder:['/music']});
  expect(result.tracks.map(t=>t.id)).toEqual(['b','a','new1','new2']);
  expect(result.tracks.slice(2).map(songFolder)).toEqual(['/music','/music']);
  expect(result.tracks[2].path).toBe('/outside/new1.wav');expect(result.settings.librarySort).toBe('manual');
  expect(result.playback.order).toEqual(['b','a','new1','new2']);expect(result.playback.currentId).toBe('a');expect(result.playback.position).toBe(3.4);
});
it('imports into an empty named folder and keeps existing selections/metadata',()=>{
  const state=sanitizeState({...emptyState(),tracks:[{...song('a'),favorite:true}],folders:[{id:'named',name:'입장곡'}]});
  const result=placeImportedSongs(state,['a'],{folderId:'named'});
  expect(songFolder(result.tracks[0])).toBe('named');expect(result.tracks[0].favorite).toBe(true);
  expect(result.folders?.find(f=>f.id==='named')?.name).toBe('입장곡');
});
it('inserts imported and existing songs into a playlist once, leaving library folders and other playlists unchanged',()=>{
  const state=sanitizeState({...emptyState(),tracks:['a','b','c'].map(id=>song(id)),playlists:[{id:'p',name:'P',trackIds:['a','b']},{id:'q',name:'Q',trackIds:['a']}]});
  const result=placeImportedSongs(state,['b','c'],{playlistId:'p',trackId:'a',edge:'before'});
  expect(result.playlists[0].trackIds).toEqual(['b','c','a']);expect(result.playlists[1].trackIds).toEqual(['a']);
  expect(result.tracks.map(songFolder)).toEqual(state.tracks.map(songFolder));
});
