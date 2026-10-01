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
