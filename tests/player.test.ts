// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { AudioPlayer } from '../src/player';
it('a replaced pending song cannot seek the newly selected song to its saved position',()=>{
  const player=new AudioPlayer();
  Object.defineProperty(player.audio,'duration',{value:120,configurable:true});
  player.load('a',60,false);
  player.load('b',0,false);
  player.audio.dispatchEvent(new Event('loadedmetadata'));
  expect(player.audio.currentTime).toBe(0);
  player.dispose();
});
it('loads and seeks only inside a trimmed source and handles the trimmed end exactly once',()=>{
  const player=new AudioPlayer();Object.defineProperty(player.audio,'duration',{value:12,configurable:true});
  player.load('clip',0,false,{start:2,end:6});player.audio.dispatchEvent(new Event('loadedmetadata'));
  expect(player.audio.currentTime).toBe(2);player.seek(0);expect(player.audio.currentTime).toBe(2);player.seek(10);expect(player.audio.currentTime).toBe(6);
  let ends=0;player.onEnded=()=>ends++;Object.defineProperty(player.audio,'paused',{value:false,configurable:true});
  player.audio.dispatchEvent(new Event('timeupdate'));player.audio.dispatchEvent(new Event('ended'));expect(ends).toBe(1);player.dispose();
});
it('adjusts a paused current range without autoplay and restores unrestricted seeking',()=>{
  const player=new AudioPlayer();Object.defineProperty(player.audio,'duration',{value:12,configurable:true});player.load('a');player.audio.dispatchEvent(new Event('loadedmetadata'));
  player.setTrim({start:3,end:8});expect(player.audio.currentTime).toBe(3);expect(player.playing).toBe(false);player.setTrim(undefined);player.seek(1);expect(player.audio.currentTime).toBe(1);player.dispose();
});
