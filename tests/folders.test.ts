import { expect, it } from 'vitest';
import { buildFolderTree, folderContains } from '../src/shared/folders';
import { mergeTracks, sanitizeState } from '../src/shared/library';
import type { Track } from '../src/shared/types';
const track=(id:string,path:string,folderRoot?:string):Track=>({id,path,folderRoot,title:id,artist:'가수',album:'앨범',duration:12,format:'WAV',addedAt:1,favorite:false});

it('retains the imported root and nested folders with subtree membership',()=>{
  const tree=buildFolderTree([track('a','C:\\Music\\곡.wav','C:\\Music'),track('b','C:\\Music\\Jazz\\Live\\곡.wav','C:\\Music')]);
  expect(tree).toHaveLength(1);
  expect(tree[0].name).toBe('Music');
  expect(tree[0].trackIds).toEqual(['a','b']);
  expect(tree[0].children[0].name).toBe('Jazz');
  expect(tree[0].children[0].children[0].trackIds).toEqual(['b']);
});
it('merges overlapping roots and distinguishes matching names at different paths',()=>{
  const tree=buildFolderTree([track('a','/Music/Jazz/a.wav','/Music/Jazz'),track('b','/Music/b.wav','/Music'),track('c','/Other/Jazz/c.wav','/Other/Jazz')]);
  expect(tree.map(n=>n.path).sort()).toEqual(['/Music','/Other/Jazz']);
  expect(tree.find(n=>n.path==='/Music')?.trackIds).toEqual(['a','b']);
});
it('groups old library files by their parent folder and respects path boundaries',()=>{
  expect(buildFolderTree([track('a','/Users/me/Music/a.wav')])[0].path).toBe('/Users/me/Music');
  expect(folderContains('/Music','/Music/Jazz')).toBe(true);
  expect(folderContains('/Music','/Music-copy')).toBe(false);
  expect(folderContains('C:\\Music','c:\\MUSIC\\Jazz')).toBe(true);
  expect(folderContains('/Music','/music/Jazz')).toBe(false);
});
it('keeps an explicitly imported folder separate from loose files in its parent',()=>{
  const tree=buildFolderTree([track('loose','/Downloads/a.wav'),track('nested','/Downloads/Album/Live/b.wav','/Downloads/Album')]);
  expect(tree).toHaveLength(2);
  expect(tree.find(n=>n.path==='/Downloads/Album')?.trackIds).toEqual(['nested']);
  expect(tree.find(n=>n.path==='/Downloads')?.trackIds).toEqual(['loose']);
});
it('reimport updates folder organization while preserving favorites and saved state',()=>{
  const original={...track('a','/Music/Jazz/a.wav'),favorite:true};
  const tracks=mergeTracks([original],[track('a',original.path,'/Music')]);
  expect(tracks).toHaveLength(1);expect(tracks[0].favorite).toBe(true);
  expect(tracks[0].folderRoot).toBe('/Music');
  expect(sanitizeState({tracks}).tracks[0].folderRoot).toBe('/Music');
});
