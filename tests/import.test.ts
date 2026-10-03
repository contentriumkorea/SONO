import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { scanMusic, readTrack, parseM3U, repairMp4Metadata } from '../electron/library';
import fixtures from './fixtures/waveform-audio.json';
import type { Track } from '../src/shared/types';
function wav(){const b=Buffer.alloc(44+16000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b;}
it('scans nested files and reads real WAV duration with stable IDs',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'luma-import-'));
  try{
    await mkdir(path.join(dir,'album'));
    const file=path.join(dir,'album','밤.wav');await writeFile(file,wav());await writeFile(path.join(dir,'ignore.txt'),'ignored');
    expect(await scanMusic([dir])).toEqual([await realpath(file)]);
    const track=await readTrack(file);
    expect(track.title).toBe('밤');expect(track.duration).toBeCloseTo(1,2);
    expect(track.path).toBe(await realpath(file));
    expect((await readTrack(file)).id).toBe(track.id);
  }finally{await rm(dir,{recursive:true,force:true});}
});
it('M3U resolves relative local files and ignores remote stream URLs',()=>{
  const base=path.resolve('music');
  expect(parseM3U('#EXTM3U\n#EXTINF:1,Song\nalbum/song.wav\nhttps://example.com/radio\n',path.join(base,'mix.m3u'))).toEqual([path.join(base,'album','song.wav')]);
});
it('unreadable scan entries are reported while other valid music is imported',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'luma-scan-'));
  try{
    const file=path.join(dir,'good.wav');await writeFile(file,wav());const failures:string[]=[];
    expect(await scanMusic([path.join(dir,'missing'),file],failed=>failures.push(failed))).toEqual([await realpath(file)]);
    expect(failures).toEqual([path.join(dir,'missing')]);
  }finally{await rm(dir,{recursive:true,force:true});}
});

it('reads the real AAC/MP4 duration even when the file is named .mp3',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-mislabeled-'));
  try{
    const file=path.join(dir,'wrong.mp3');await writeFile(file,Buffer.from(fixtures.m4a,'base64'));
    const track=await readTrack(file);expect(track.duration).toBeCloseTo(12.064,3);expect(track.format).toBe('M4A');expect(track.sampleRate).toBe(16000);expect(track.path).toBe(await realpath(file));
  }finally{await rm(dir,{recursive:true,force:true});}
});
it('repairs previously saved mislabeled MP4 metadata while preserving library edits',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sono-metadata-repair-'));
  try{
    const file=path.join(dir,'wrong.mp3'),bytes=Buffer.from(fixtures.m4a,'base64');await writeFile(file,bytes);
    const track:Track={id:'existing-id',path:file,title:'Original',artist:'Artist',album:'Album',duration:.04,format:'MP3',addedAt:1,favorite:true,folderId:'folder',displayName:'Custom',trim:{start:0,end:.04}};
    const missing={...track,id:'missing',path:path.join(dir,'missing.mp3')},tracks=[track,missing];
    expect(await repairMp4Metadata(tracks)).toBe(true);expect(track.duration).toBeCloseTo(12.064,3);expect(track.format).toBe('M4A');expect(track).toMatchObject({id:'existing-id',displayName:'Custom',favorite:true,folderId:'folder',title:'Original',addedAt:1});expect(track.trim).toBeUndefined();expect(missing.duration).toBe(.04);
    expect(await repairMp4Metadata(tracks)).toBe(false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
