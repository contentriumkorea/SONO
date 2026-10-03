import { expect,it } from 'vitest';
import { sanitizeTrim,trimBounds,parseTrimTime,trimTime } from '../src/shared/trim';
import { sanitizeState,emptyState } from '../src/shared/library';
import type { Track } from '../src/shared/types';
it('validates ranges against the original duration and rejects empty/reversed/nonfinite ranges',()=>{
  expect(sanitizeTrim({start:10,end:200},120)).toEqual({start:10,end:120});
  for(const value of [{start:10,end:9},{start:10,end:10},{start:NaN,end:20},'bad'])expect(sanitizeTrim(value,120)).toBeUndefined();
  expect(sanitizeTrim({start:0,end:120},120)).toBeUndefined();expect(trimBounds({duration:120,trim:{start:10,end:20}})).toEqual({start:10,end:20,duration:10});
});
it('parses precise time input, rejects invalid times, and preserves valid trim in stored state',()=>{
  expect(parseTrimTime('1:02.5')).toBe(62.5);expect(parseTrimTime('1:02:03')).toBe(3723);expect(parseTrimTime('90')).toBe(90);expect(parseTrimTime('1:99')).toBeNull();
  expect(trimTime(62.5)).toBe('1:02.5');
  const state=emptyState();state.tracks=[{id:'a',path:'/a.wav',title:'A',duration:120,trim:{start:3,end:10}} as Track];
  expect(sanitizeState(state).tracks[0].trim).toEqual({start:3,end:10});
  state.tracks[0].trim={start:10,end:5};expect(sanitizeState(state).tracks[0].trim).toBeUndefined();
});
