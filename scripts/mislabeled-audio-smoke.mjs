import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp,mkdir,writeFile,readFile,rm,realpath,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd();
const dir=await realpath(await mkdtemp(path.join(tmpdir(),'sono-mislabeled-'))),data=path.join(dir,'data');await mkdir(path.join(data,'waveforms'),{recursive:true});await mkdir('test-results',{recursive:true});
const actual=process.env.SONO_WAVEFORM_SOURCE;let file;
if(actual)file=await realpath(actual);else{file=path.join(dir,'AAC 내용의 MP3.mp3');const f=JSON.parse(await readFile('tests/fixtures/waveform-audio.json','utf8'));await writeFile(file,Buffer.from(f.m4a,'base64'));}
const original=await readFile(file),hash=b=>createHash('sha256').update(b).digest('hex'),sourceHash=hash(original),id=hash(process.platform==='win32'?file.toLowerCase():file),s=await stat(file);
const oldKey=hash(`wave-v1:${file}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`),bad=Array(960).fill(0);bad[959]=1;await writeFile(path.join(data,'waveforms',`${oldKey}.json`),JSON.stringify(bad));
// Mimic an already installed 0.1.7 library, including its corrupted metadata/cache.
const track={id,path:file,title:'Saved title',artist:'Saved artist',album:'Saved album',duration:.042666666666666665,format:'MP3',sampleRate:48000,addedAt:1,favorite:true,folderId:'custom-folder',displayName:'시험 곡'};
const initial={version:1,tracks:[track],folders:[{id:'custom-folder',name:'Saved folder'}],playlists:[{id:'playlist',name:'Saved playlist',trackIds:[id]}],settings:{volume:.4,eqEnabled:false,eq:Array(20).fill(0),preamp:0,eqPreset:'Flat',librarySort:'added',fadeIn:.46,fadeOut:1.23},playback:{currentId:id,anchorId:id,position:0,queue:[],order:[id],repeat:'stop',shuffle:false}};
await writeFile(path.join(data,'state.json'),JSON.stringify(initial));
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const executable=process.env.SONO_SMOKE_EXECUTABLE,options={executablePath:executable||require('electron'),args:executable?[]:[root],env};
let app,page;const errors=[],button=name=>page.getByRole('button',{name,exact:true});
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
async function ready(){await page.waitForFunction(()=>document.querySelector('[data-waveform-state="ready"]'),{},{timeout:120000});}
try{
  await launch();await ready();const state=(await page.evaluate(()=>window.luma.getState())).state,repaired=state.tracks[0];
  assert.equal(repaired.format,'M4A');assert.ok(repaired.duration>12);if(!actual)assert.ok(Math.abs(repaired.duration-12.064)<.001);
  assert.equal(repaired.id,id);assert.equal(repaired.path,file);assert.equal(repaired.displayName,'시험 곡');assert.equal(repaired.favorite,true);assert.equal(repaired.folderId,'custom-folder');assert.deepEqual(state.playlists,initial.playlists);assert.deepEqual(state.settings,initial.settings);
  const media=await page.evaluate(()=>({duration:document.querySelector('audio').duration,paused:document.querySelector('audio').paused}));assert.equal(media.paused,true);assert.ok(Math.abs(media.duration-repaired.duration)<.1);
  console.log(`PASS existing mislabeled AAC/MP4 metadata repaired to ${repaired.duration.toFixed(3)} seconds with identity, names, folders, favorites, playlists, settings and no autoplay preserved`);
  const info=await page.evaluate(id=>window.luma.getWaveform(id),id);assert.notEqual(info.key,oldKey);assert.equal(info.peaks.length,960);assert.ok(info.peaks.filter(p=>p>0).length>400);
  const h=await page.locator('.waveform-remaining rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));assert.ok(h.filter(v=>v>1).length>70);
  if(!actual){assert.equal(h[10],1);assert.ok(h[100]>h[55]*2.5);assert.equal(h[150],1);}
  await button('시험 곡 재생').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.1);await button('시험 곡 일시정지').click();await page.waitForFunction(()=>document.querySelector('audio').paused);
  await page.getByRole('slider',{name:'재생 위치'}).fill((repaired.duration*.8).toFixed(2));assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-repaired.duration*.8)<.2);assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  console.log('PASS old collapsed waveform ignored; real decoded peaks cover the full song, correct content MIME plays and seeking uses full duration');
  await button('음원 길이 조정').click();await page.getByRole('dialog',{name:'음원 길이 조정'}).waitFor();await button('취소').click();
  if(actual)await page.locator('.player-bar').screenshot({path:'test-results/SONO-shingiju-fixed-player.png'});
  await app.close();app=undefined;await launch();await ready();const second=(await page.evaluate(()=>window.luma.getState())).state;assert.equal(second.tracks[0].duration,repaired.duration);assert.equal(second.tracks[0].displayName,'시험 곡');assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);assert.deepEqual(errors,[]);assert.equal(hash(await readFile(file)),sourceHash);
  console.log('PASS repaired metadata and full waveform persist on restart, no renderer errors, and original audio SHA-256 unchanged');
}finally{if(app)await app.close();await rm(dir,{recursive:true,force:true});}
