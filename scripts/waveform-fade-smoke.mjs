import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp,mkdir,writeFile,readFile,rm,realpath,open,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd();
const dir=await realpath(await mkdtemp(path.join(tmpdir(),'sono-wave-fade-'))),data=path.join(dir,'data');
await mkdir(data);await mkdir('test-results',{recursive:true});
// An ordinary file at the cache location deterministically prevents disk caching.
await writeFile(path.join(data,'waveforms'),'cache unavailable');
const wav=path.join(dir,'PCM.wav'),flac=path.join(dir,'FLAC.flac'),aiff=path.join(dir,'긴 AIFF.aiff'),mp3=path.join(dir,'긴 MP3.mp3');
const rate=16000,frames=rate*12,b=Buffer.alloc(44+frames*2);
b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*440*Math.PI*2)*(i<rate*3?0:i<rate*6?.2:i<rate*9?.8:0)*32767),44+i*2);
await writeFile(wav,b);const fixtures=JSON.parse(await readFile('tests/fixtures/waveform-audio.json','utf8'));await writeFile(flac,Buffer.from(fixtures.flac,'base64'));
await writeFile(mp3,Buffer.concat(['silence','quiet','loud','silence'].flatMap(name=>Array(300).fill(Buffer.from(fixtures[name],'base64')))));
// 70 minutes of sparse, legal stereo AIFF PCM with real tone bursts, >128 MiB.
const duration=4200,aiffFrames=duration*rate,size=aiffFrames*4,header=Buffer.alloc(54);
header.write('FORM');header.writeUInt32BE(size+46,4);header.write('AIFFCOMM',8);header.writeUInt32BE(18,16);header.writeUInt16BE(2,20);header.writeUInt32BE(aiffFrames,22);header.writeUInt16BE(16,26);header.writeUInt16BE(0x400c,28);header.writeUInt16BE(0xfa00,30);header.write('SSND',38);header.writeUInt32BE(size+8,42);
const handle=await open(aiff,'w');try{
  await handle.write(header,0,header.length,0);await handle.truncate(54+size);
  for(const [time,amp] of [[1100,.2],[2300,.8]]){const tone=Buffer.alloc(rate*4);for(let i=0;i<rate;i++){const v=Math.round(Math.sin(i/rate*440*Math.PI*2)*amp*32767);tone.writeInt16BE(v,i*4);tone.writeInt16BE(-v,i*4+2);}await handle.write(tone,0,tone.length,54+time*rate*4);}
}finally{await handle.close();}assert.ok((await stat(aiff)).size>128*1024**2);
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const executable=process.env.SONO_SMOKE_EXECUTABLE,options={executablePath:executable||require('electron'),args:executable?[]:[root],env};
let app,page;const errors=[];const button=name=>page.getByRole('button',{name,exact:true});
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
async function ready(){await page.waitForFunction(()=>document.querySelector('[data-waveform-state="ready"]'),{},{timeout:120000});}
async function heights(){return page.locator('.waveform-remaining rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));}
try{
  await launch();await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},[wav,flac,aiff,mp3]);await button('첫 음악 가져오기').click();await button('긴 AIFF').waitFor();
  await button('PCM 재생').click();await ready();await button('PCM 일시정지').click();let h=await heights();assert.equal(h[10],1);assert.ok(h[100]>h[55]*3);assert.equal(h[150],1);
  console.log('PASS native WAV waveform remains visible with an unwritable cache');
  await button('FLAC 재생').click();await ready();await button('FLAC 일시정지').click();h=await heights();assert.equal(h[10],1);assert.ok(h[100]>h[55]*2.5);assert.equal(h[150],1);
  console.log('PASS real FLAC browser decoding remains visible after cache IPC save failure');
  await button('긴 MP3 재생').click();await ready();await button('긴 MP3 일시정지').click();h=await heights();assert.equal(h[10],1);assert.ok(h[105]>h[55]*2.5);assert.equal(h[150],1);
  console.log('PASS actual hour-long MP3 waveform remains visible after cache save failure');
  await button('긴 AIFF 재생').click();await ready();h=await heights();assert.equal(h[10],1);assert.ok(h[87]>h[41]*3);assert.equal(h[150],1);
  const info=await page.evaluate(async()=> (await window.luma.getState()).state.tracks.find(t=>t.title==='긴 AIFF'));assert.equal(info.duration,4200);
  assert.equal((await stat(path.join(data,'waveforms'))).isFile(),true);
  console.log('PASS actual 70-minute >128 MiB stereo AIFF waveform: bounded native reads, opposite-phase channels, real quiet/loud bursts and silence');
  await button('PCM 재생').click();await ready();await button('PCM 일시정지').click();const toast=page.locator('.toast');if(await toast.count())await toast.getByRole('button').click();
  await button('페이드 설정').click();await button('페이드 인 초 직접 입력').dblclick();let input=page.getByRole('spinbutton',{name:'페이드 인 초',exact:true});await input.fill('2.37');await input.press('Enter');assert.equal(await page.getByRole('slider',{name:'페이드 인 시간'}).inputValue(),'2.37');
  await button('페이드 아웃 초 직접 입력').dblclick();input=page.getByRole('spinbutton',{name:'페이드 아웃 초',exact:true});await input.fill('1.23');await page.getByRole('slider',{name:'페이드 인 시간'}).focus();assert.equal(await page.getByRole('slider',{name:'페이드 아웃 시간'}).inputValue(),'1.23');
  await button('페이드 인 초 직접 입력').dblclick();input=page.getByRole('spinbutton',{name:'페이드 인 초',exact:true});await input.fill('6');await input.press('Enter');assert.equal(await input.getAttribute('aria-invalid'),'true');assert.equal(await page.getByRole('slider',{name:'페이드 인 시간'}).inputValue(),'2.37');await input.press('Escape');await page.getByRole('dialog',{name:'부드러운 재생'}).waitFor();await button('페이드 인 초 직접 입력').waitFor();
  await page.getByRole('slider',{name:'페이드 인 시간'}).fill('0.46');assert.equal(await button('페이드 인 초 직접 입력').textContent(),'0.46초');
  await button('페이드 아웃 초 직접 입력').focus();await page.keyboard.press('Enter');await page.getByRole('spinbutton',{name:'페이드 아웃 초',exact:true}).press('Escape');
  await page.screenshot({path:'test-results/SONO-fade-direct.png'});await button('닫기').click();
  await page.waitForFunction(async()=>{const s=(await window.luma.getState()).state.settings;return s.fadeIn===.46&&s.fadeOut===1.23;});
  console.log('PASS fade double-click, Enter and blur apply exact seconds, range validation, Escape cancels without closing dialog, keyboard entry and slider compatibility');
  await app.close();app=undefined;await launch();await button('페이드 설정').click();assert.equal(await button('페이드 인 초 직접 입력').textContent(),'0.46초');assert.equal(await button('페이드 아웃 초 직접 입력').textContent(),'1.23초');assert.deepEqual(errors,[]);
  console.log('PASS exact fade settings persist after application restart; no renderer errors');
}finally{if(app)await app.close();await rm(dir,{recursive:true,force:true});}
