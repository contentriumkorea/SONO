import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp,mkdir,writeFile,readFile,rm,readdir,realpath,open,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd();
const fixtures=JSON.parse(await readFile('tests/fixtures/waveform-audio.json','utf8'));
const dir=await realpath(await mkdtemp(path.join(tmpdir(),'sono-long-wave-'))),data=path.join(dir,'data');await mkdir(data);
const long=path.join(dir,'긴 MP3.mp3'),flac=path.join(dir,'FLAC.flac'),aac=path.join(dir,'AAC.m4a');
const large=path.join(dir,'큰 FLAC.flac');
// Repeat independent CBR MP3 frames with no bit reservoir/Xing/ID3 headers.
// More than an hour of actual audio: silence, quiet tone, loud tone, silence.
await writeFile(long,Buffer.concat(['silence','quiet','loud','silence'].flatMap(name=>Array(300).fill(Buffer.from(fixtures[name],'base64')))));
await writeFile(flac,Buffer.from(fixtures.flac,'base64'));await writeFile(aac,Buffer.from(fixtures.m4a,'base64'));
// Legal FLAC PADDING metadata makes a >128 MiB source without committing huge fixtures.
// Sparse padding is skipped via byte ranges; the decoded audio is still real stereo PCM.
const source=Buffer.from(fixtures.flac,'base64');let end=4,last=4;
for(;;){last=end;const final=!!(source[end]&128);end+=4+source.readUIntBE(end+1,3);if(final)break;}
const prefix=Buffer.from(source.subarray(0,end));prefix[last]&=127;
const handle=await open(large,'w');try{await handle.write(prefix,0,prefix.length,0);let at=end;for(let i=0;i<9;i++){const header=Buffer.from([i===8?129:1,0xf0,0,0]);await handle.write(header,0,4,at);at+=4+0xf00000;}await handle.write(source.subarray(end),0,source.length-end,at);}finally{await handle.close();}
assert.ok((await stat(large)).size>128*1024**2);
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const executable=process.env.SONO_SMOKE_EXECUTABLE,options={executablePath:executable||require('electron'),args:executable?[]:[root],env};
let app,page;const errors=[];const button=name=>page.getByRole('button',{name,exact:true});
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
async function ready(){await page.waitForFunction(()=>document.querySelector('[data-waveform-state="ready"]'),{},{timeout:180000});}
async function heights(){return page.locator('.waveform-remaining rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));}
try{
  await launch();await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},[long,flac,aac,large]);await button('첫 음악 가져오기').click();await button('긴 MP3').waitFor();
  const track=await page.evaluate(async()=> (await window.luma.getState()).state.tracks.find(t=>t.title==='긴 MP3'));assert.ok(track.duration>3600);
  await page.evaluate(()=>{const original=window.fetch.bind(window);window.waveRanges=[];window.wholeDecodes=0;window.progressSeen=false;new MutationObserver(()=>{if(document.querySelector('.waveform-status')?.textContent.includes('%'))window.progressSeen=true;}).observe(document.body,{childList:true,subtree:true});const decode=OfflineAudioContext.prototype.decodeAudioData;OfflineAudioContext.prototype.decodeAudioData=function(...args){window.wholeDecodes++;return decode.apply(this,args);};window.fetch=async(url,init)=>{const response=await original(url,init);if(String(url).startsWith('luma://audio/'))window.waveRanges.push({range:new Headers(init?.headers).get('Range'),status:response.status});return response;};});
  await button('긴 MP3 재생').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.1);await button('긴 MP3 일시정지').click();await ready();
  let h=await heights();assert.equal(h[10],1);assert.ok(h[55]>2);assert.ok(h[105]>h[55]*2.5);assert.equal(h[150],1);
  const measures=await page.evaluate(()=>({ranges:window.waveRanges,decodes:window.wholeDecodes,progress:window.progressSeen}));assert.equal(measures.decodes,0);assert.ok(measures.ranges.length);assert.ok(measures.ranges.every(r=>r.range&&r.status===206));assert.equal(measures.progress,true);
  await page.getByRole('slider',{name:'재생 위치'}).fill(String(Math.floor(track.duration*.9)));assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-track.duration*.9)<2);assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  console.log(`PASS ${Math.round(track.duration)}-second actual MP3 waveform: silent/quiet/loud/tail sections, progress, ranged reads, no whole-file decode, seeking and paused state`);
  await button('FLAC 재생').click();await ready();await button('FLAC 일시정지').click();h=await heights();assert.equal(h[10],1);assert.ok(h[100]>h[55]*2.5);assert.equal(h[150],1);
  console.log('PASS actual stereo FLAC chunk decoding and transient/silence levels');
  await button('AAC 재생').click();await ready();await button('AAC 일시정지').click();h=await heights();assert.equal(h[10],1);assert.ok(h[100]>h[55]*2.5);assert.equal(h[150],1);assert.equal(await page.evaluate(()=>window.wholeDecodes),0);
  console.log('PASS actual AAC/M4A chunk decoding and transient/silence levels');
  await button('큰 FLAC 재생').click();await ready();await button('큰 FLAC 일시정지').click();h=await heights();assert.equal(h[10],1);assert.ok(h[100]>h[55]*2.5);assert.equal(h[150],1);assert.equal(await page.evaluate(()=>window.wholeDecodes),0);
  console.log('PASS actual >128 MiB valid FLAC source with sparse PADDING metadata, ranged decoding and correct stereo waveform');
  // Cancel a new uncached long analysis by immediately changing to a cached song.
  const info=await page.evaluate(id=>window.luma.getWaveform(id),track.id);await rm(path.join(data,'waveforms',`${info.key}.json`));
  await button('긴 MP3 재생').click();await page.waitForFunction(()=>document.querySelector('.waveform-status'));await button('AAC 재생').click();await ready();assert.equal(await page.locator('.waveform-status').count(),0);await button('AAC 일시정지').click();
  assert.ok((await readdir(path.join(data,'waveforms'))).length>=2);assert.deepEqual(errors,[]);
  await app.close();app=undefined;await launch();await ready();assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);assert.deepEqual(errors,[]);
  console.log('PASS switching away cancels long decoding without stale waveform, cached reload and no autoplay');
}finally{if(app)await app.close();await rm(dir,{recursive:true,force:true});}
