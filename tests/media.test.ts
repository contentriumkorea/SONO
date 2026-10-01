import { expect, it } from 'vitest';
import { parseRange } from '../electron/media';
it('serves seek ranges and clamps the last byte to actual file size',()=>{
  expect(parseRange('bytes=40-999',100)).toEqual({start:40,end:99});
  expect(parseRange('bytes=-10',100)).toEqual({start:90,end:99});
  expect(parseRange('bytes=100-',100)).toBeNull();
  expect(parseRange('bytes=0-0',100)).toEqual({start:0,end:0});
  expect(parseRange('bytes=a-b',100)).toBeNull();
});
