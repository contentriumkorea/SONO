import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'sono-playback-')),data=path.join(dir,'data');
await mkdir(data);await mkdir('test-results',{recursive:true});
function wave(){
  const size=44100*2*12,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}
const files=['방식 A','방식 B'].map(name=>path.join(dir,`${name}.wav`));for(const file of files)await writeFile(file,wave());
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const packaged=process.argv.includes('--packaged'),options={executablePath:packaged?path.join(root,'release','win-unpacked','SONO.exe'):require('electron'),args:packaged?[]:[root],env};
let app,page;const errors=[];
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
const button=name=>page.getByRole('button',{name,exact:true});
async function mode(name){await page.getByRole('button',{name:/^재생 방식:/}).click();await page.getByRole('radio',{name,exact:true}).check();await button('닫기').click();}
async function play(name){await button(`${name} 재생`).click();await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0.1);}
async function finish(){
  const count=await page.evaluate(()=>{window.songEnds??=0;const a=document.querySelector('audio');if(!window.countingEnds){a.addEventListener('ended',()=>window.songEnds++);window.countingEnds=true;}return window.songEnds;});
  await page.getByRole('slider',{name:'재생 위치'}).fill('11.8');await page.waitForFunction(previous=>window.songEnds>previous,count);
}
async function queue(name){await button(`${name} 더 보기`).click();await button('대기열에 추가').click();}
try{
  await launch();await app.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths});},files);
  await button('첫 음악 가져오기').click();await button('방식 A').waitFor();await page.getByRole('combobox',{name:'음악 정렬'}).selectOption('title');
  await page.getByRole('button',{name:'재생 방식: 다음 곡 자동 재생'}).click();assert.equal(await page.getByRole('radio',{name:'다음 곡 자동 재생',exact:true}).isChecked(),true);await button('닫기').click();
  await play('방식 A');await finish();await page.waitForFunction(()=>document.querySelector('.now-playing strong').textContent==='방식 B'&&!document.querySelector('audio').paused);
  console.log('PASS automatic playback advances to the next song');
  await mode('한 곡 반복');await queue('방식 A');await button('셔플').click();
  const source=await page.locator('audio').getAttribute('src');await finish();
  await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0.05&&document.querySelector('audio').currentTime<2);
  assert.equal(await page.locator('audio').getAttribute('src'),source);assert.equal(await page.locator('.now-playing strong').textContent(),'방식 B');
  let state=(await page.evaluate(()=>window.luma.getState())).state;assert.equal(state.playback.queue.length,1);assert.equal(state.playback.repeat,'one');
  await finish();await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime<2);
  assert.equal(await page.locator('audio').getAttribute('src'),source);
  console.log('PASS repeat one across multiple endings while preserving queue and ignoring shuffle');
  await mode('현재 곡만 재생 후 정지');await finish();await page.waitForFunction(()=>document.querySelector('audio').paused&&document.querySelector('audio').currentTime<0.1);
  assert.equal(await page.locator('.now-playing strong').textContent(),'방식 B');state=(await page.evaluate(()=>window.luma.getState())).state;assert.equal(state.playback.queue.length,1);
  await button('방식 B 재생').click();await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0.1);
  await button('다음 곡').click();await page.waitForFunction(()=>document.querySelector('.now-playing strong').textContent==='방식 A'&&!document.querySelector('audio').paused);
  state=(await page.evaluate(()=>window.luma.getState())).state;assert.equal(state.playback.queue.length,0);assert.equal(state.playback.repeat,'stop');
  await page.getByRole('button',{name:/^재생 방식:/}).click();await page.screenshot({path:'test-results/SONO-playback-modes.png'});await button('닫기').click();
  await app.close();assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).playback.repeat,'stop');
  await launch();await button('방식 A').waitFor();await page.getByRole('button',{name:'재생 방식: 현재 곡만 재생 후 정지'}).click();assert.equal(await page.getByRole('radio',{name:'현재 곡만 재생 후 정지',exact:true}).isChecked(),true);await button('닫기').click();
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  console.log('PASS stop after current song, replay, manual next, and persisted mode without autoplay');
  await mode('다음 곡 자동 재생');await button('셔플').click();
  await page.getByRole('button',{name:/^재생 방식:/}).click();await page.getByRole('checkbox',{name:'목록 마지막 곡 뒤에는 처음부터 다시 재생'}).check();await button('닫기').click();
  await play('방식 B');await finish();await page.waitForFunction(()=>document.querySelector('.now-playing strong').textContent==='방식 A'&&!document.querySelector('audio').paused);
  await app.close();await launch();await page.getByRole('button',{name:/^재생 방식:/}).click();assert.equal(await page.getByRole('checkbox',{name:'목록 마지막 곡 뒤에는 처음부터 다시 재생'}).isChecked(),true);
  assert.deepEqual(errors,[]);console.log('PASS optional list repeat and saved preference; no renderer errors');
}catch(error){await page?.screenshot({path:'test-results/playback-failure.png'}).catch(()=>{});throw error;}
finally{await app?.close().catch(()=>{});await rm(dir,{recursive:true,force:true});}
