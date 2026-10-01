import { describe, expect, it } from 'vitest';
import { mergeTracks, nextTrack, searchTracks, sanitizeState, advancePlayback } from '../src/shared/library';

const song = (id: string, title = id) => ({ id, path: `/music/${id}.wav`, title, artist: '가수', album: '앨범', duration: 10, format: 'WAV', addedAt: 1, favorite: false });
describe('playback order', () => {
  it('returns to the original next song after an external queued song',()=>{
    const initial={currentId:'a',anchorId:'a',position:0,order:['a','b','c'],queue:['x'],repeat:'off' as const,shuffle:false};
    const queued=advancePlayback(initial,['a','b','c','x'],true);
    expect(queued.currentId).toBe('x');
    expect(advancePlayback(queued,['a','b','c','x'],true).currentId).toBe('b');
  });
  it('repeats the current song even with a queue and shuffle enabled', () => {
    expect(nextTrack(['a','b','c'], 'a', ['c','b'], 'one', true, true)).toEqual({ id: 'a', queue: ['c','b'] });
    const state={currentId:'c',anchorId:'a',position:10,order:['a','b'],queue:['b'],repeat:'one' as const,shuffle:true};
    expect(advancePlayback(state,['a','b','c'],true)).toMatchObject({currentId:'c',anchorId:'a',queue:['b'],position:0});
  });
  it('stops after the current song while retaining queued songs; manual next still works',()=>{
    const state={currentId:'a',anchorId:'a',position:10,order:['a','b'],queue:['b'],repeat:'stop' as const,shuffle:true};
    expect(advancePlayback(state,['a','b'],true)).toMatchObject({currentId:null,queue:['b'],position:0});
    expect(nextTrack(['a','b'],'a',['b'],'stop',true,true)).toEqual({id:null,queue:['b']});
    expect(advancePlayback(state,['a','b'],false)).toMatchObject({currentId:'b',queue:[]});
  });
  it('restores the stop-after-song setting and defaults old libraries to automatic playback',()=>{
    expect(sanitizeState({tracks:[song('a')],playback:{repeat:'stop'}}).playback.repeat).toBe('stop');
    expect(sanitizeState({tracks:[song('a')],playback:{}}).playback.repeat).toBe('off');
  });
  it('stops at last song without repeat and wraps with repeat-all', () => {
    expect(nextTrack(['a','b'], 'b', [], 'off', false, true).id).toBeNull();
    expect(nextTrack(['a','b'], 'b', [], 'all', false, true).id).toBe('a');
  });
  it('repeats one on ended but manual next advances', () => {
    expect(nextTrack(['a','b'], 'a', [], 'one', false, true).id).toBe('a');
    expect(nextTrack(['a','b'], 'a', [], 'one', false, false).id).toBe('b');
  });
  it('shuffle never returns current song when alternatives exist', () => {
    expect(nextTrack(['a','b'], 'a', [], 'off', true, false, () => 0).id).toBe('b');
  });
  it('discards stale queue IDs', () => {
    expect(nextTrack(['a','b'], 'a', ['missing','b'], 'off', false, true)).toEqual({ id: 'b', queue: [] });
  });
});
describe('library', () => {
  it('restores manual library sorting while retaining reordered track IDs',()=>{
    const result=sanitizeState({tracks:[song('b'),song('a')],settings:{librarySort:'manual'}});
    expect(result.settings.librarySort).toBe('manual');
    expect(result.tracks.map(track=>track.id)).toEqual(['b','a']);
  });
  it('reimport keeps favorites and only adds new files', () => {
    const original = { ...song('a'), favorite: true };
    const result = mergeTracks([original], [song('a'), song('b')]);
    expect(result).toHaveLength(2);
    expect(result[0].favorite).toBe(true);
  });
  it('search matches Korean metadata with whitespace trimmed', () => {
    expect(searchTracks([song('a','밤 산책'),song('b','아침')], ' 밤 ')).toHaveLength(1);
  });
  it('removes dangling playlist and queue references on restore', () => {
    const result = sanitizeState({ tracks: [song('a')], playlists: [{id:'p',name:'여행',trackIds:['a','gone']}], playback:{currentId:'gone',queue:['a','gone'],order:['a','gone']}, settings:{volume:5} });
    expect(result.playlists[0].trackIds).toEqual(['a']);
    expect(result.playback.currentId).toBeNull();
    expect(result.playback.queue).toEqual(['a']);
    expect(result.settings.volume).toBe(1);
  });
});
