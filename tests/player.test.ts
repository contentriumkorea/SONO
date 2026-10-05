// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { AudioPlayer } from '../src/player';
import { vi } from 'vitest';
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
it('repeats A–B without advancing the queue, including when B is the physical end',()=>{
  vi.useFakeTimers();const player=new AudioPlayer();
  try{
    Object.defineProperty(player.audio,'duration',{value:12,configurable:true});player.load('a');player.audio.dispatchEvent(new Event('loadedmetadata'));
    let ended=0;player.onEnded=()=>ended++;player.setLoop({start:2,end:4});expect(player.audio.currentTime).toBe(2);expect(player.playing).toBe(false);
    Object.defineProperty(player.audio,'paused',{value:false,configurable:true});player.audio.currentTime=4;player.audio.dispatchEvent(new Event('timeupdate'));expect(player.audio.currentTime).toBe(2);expect(ended).toBe(0);
    player.setLoop({start:3,end:12});player.audio.currentTime=12;player.audio.dispatchEvent(new Event('ended'));expect(player.audio.currentTime).toBe(3);expect(ended).toBe(0);
    player.setLoop(undefined);player.audio.currentTime=12;player.audio.dispatchEvent(new Event('ended'));expect(ended).toBe(1);
  }finally{player.dispose();vi.useRealTimers();}
});
it('clamps seeks inside A–B and clears the loop on source or trim changes',()=>{
  const player=new AudioPlayer();Object.defineProperty(player.audio,'duration',{value:12,configurable:true});
  try{
    player.load('a',0,false,{start:2,end:10});player.audio.dispatchEvent(new Event('loadedmetadata'));player.setLoop({start:3,end:5});
    player.seek(0);expect(player.audio.currentTime).toBe(3);player.seek(9);expect(player.audio.currentTime).toBe(5);
    player.setTrim({start:2,end:8});player.seek(7);expect(player.audio.currentTime).toBe(7);expect(player.playing).toBe(false);
    player.setLoop({start:3,end:5});player.load('b');player.audio.dispatchEvent(new Event('loadedmetadata'));player.seek(1);expect(player.audio.currentTime).toBe(1);
  }finally{player.dispose();}
});
it('ignores a cancelled physical-end loop restart when playback is interrupted',async()=>{
  const player=new AudioPlayer();Object.defineProperty(player.audio,'duration',{value:12,configurable:true});
  const error=vi.fn();player.onError=error;vi.spyOn(player.audio,'play').mockRejectedValue(new DOMException('interrupted','AbortError'));
  try{
    player.load('a');player.audio.dispatchEvent(new Event('loadedmetadata'));player.setLoop({start:3,end:12});player.audio.currentTime=12;player.audio.dispatchEvent(new Event('ended'));
    player.load('b');await Promise.resolve();await Promise.resolve();expect(error).not.toHaveBeenCalled();
  }finally{player.dispose();}
});
