import { afterEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({track:{canDecode:vi.fn(async()=>true),computeDuration:vi.fn(async()=>209.9)},dispose:vi.fn(),streamPeaks:vi.fn(async(..._args:unknown[])=>Array(960).fill(.5))}));
vi.mock('mediabunny',()=>({ALL_FORMATS:[],UrlSource:class{},Input:class{getPrimaryAudioTrack=async()=>mocks.track;dispose=mocks.dispose;},AudioBufferSink:class{buffers=()=>({async *[Symbol.asyncIterator](){}});}}));
vi.mock('../src/shared/stream-waveform',()=>({streamPeaks:mocks.streamPeaks}));
import { decodeStream } from '../src/stream-waveform';
afterEach(()=>vi.clearAllMocks());
it('uses the decoded media timeline instead of stale imported duration',async()=>{
  const signal=new AbortController().signal;await decodeStream('luma://audio/song',.04,signal);
  expect(mocks.track.computeDuration).toHaveBeenCalled();expect(mocks.streamPeaks.mock.calls[0][1]).toBe(209.9);expect(mocks.dispose).toHaveBeenCalledTimes(1);
});
