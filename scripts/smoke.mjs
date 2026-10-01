import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const root=process.cwd();const dir=await mkdtemp(path.join(tmpdir(),'luma-smoke-'));
const data=path.join(dir,'data');await mkdir(data);await mkdir('test-results',{recursive:true});
function wave(seconds,frequency){
  const rate=44100;const dataSize=seconds*rate*2;const b=Buffer.alloc(44+dataSize);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(dataSize,40);
  for(let i=0;i<dataSize/2;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*frequency*Math.PI*2)*1600),44+i*2);
  return b;
}
const files=[path.join(dir,'검증 음악 A.wav'),path.join(dir,'검증 음악 B.wav')];
await writeFile(files[0],wave(12,440));await writeFile(files[1],wave(12,660));
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
let application;let activePage;const errors=[];
async function launch(){
  const packaged=process.argv.includes('--packaged');
  application=await electron.launch({executablePath:packaged?path.join(root,'release','win-unpacked','SONO.exe'):require('electron'),args:packaged?[]:[root],env});
  const page=await application.firstWindow();
  activePage=page;
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('heading',{name:'내 음악.'}).waitFor();
  return page;
}
try{
  let page=await launch();
  await page.screenshot({path:'test-results/empty-state.png'});
  await application.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths});},files);
  await page.getByRole('button',{name:'첫 음악 가져오기'}).click();
  await page.getByRole('button',{name:'검증 음악 A',exact:true}).waitFor();
  assert.equal(await page.getByRole('row').count(),3);
  console.log('PASS real WAV import and library');
  await page.getByRole('button',{name:'음악 추가'}).click();await page.getByRole('button',{name:'파일 가져오기',exact:true}).click();
  await page.waitForTimeout(400);assert.equal(await page.getByRole('row').count(),3);console.log('PASS duplicate import');
  await page.getByRole('button',{name:'검증 음악 A 재생',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.4);
  const audio=await page.evaluate(()=>{const a=document.querySelector('audio');return {time:a.currentTime,duration:a.duration,paused:a.paused,error:a.error?.code};});
  assert.equal(audio.paused,false);assert.ok(audio.duration>11);assert.equal(audio.error,undefined);console.log('PASS actual audio playback',audio);
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('audio').paused);
  const paused=await page.evaluate(()=>document.querySelector('audio').currentTime);await page.waitForTimeout(400);
  assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-paused)<0.1);console.log('PASS pause');
  await page.getByRole('slider',{name:'재생 위치'}).fill('4');
  assert.ok(await page.evaluate(()=>document.querySelector('audio').currentTime)>=3.9);console.log('PASS byte range seek');
  await page.getByRole('button',{name:'검증 음악 A 좋아요',exact:true}).click();
  await page.getByRole('button',{name:'재생목록 만들기',exact:true}).click();await page.getByPlaceholder('예: 밤 산책, 집중할 때').fill('밤 산책');await page.getByRole('button',{name:'만들기',exact:true}).click();
  await page.getByRole('button',{name:'내 음악',exact:false}).first().click();
  await page.getByRole('button',{name:'검증 음악 A 더 보기'}).click();await page.getByRole('button',{name:'재생목록에 추가',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'밤 산책'}).click();
  console.log('PASS favorites and playlist creation/assignment');
  await page.getByRole('button',{name:'검증 음악 B 더 보기'}).click();await page.getByRole('button',{name:'대기열에 추가'}).click();
  await page.getByRole('button',{name:'재생 대기열',exact:true}).click();assert.ok(await page.locator('.queue-track').count()===1);
  await page.getByRole('button',{name:'다음 곡',exact:true}).click();await page.waitForTimeout(250);assert.equal(await page.locator('.now-playing strong').textContent(),'검증 음악 B');
  await page.getByRole('button',{name:'대기열 닫기'}).click();console.log('PASS queue priority');
  await page.getByRole('button',{name:'이퀄라이저',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').check();await page.getByRole('combobox',{name:'EQ 프리셋'}).selectOption('따뜻하게');
  await page.screenshot({path:'test-results/equalizer.png'});await page.getByRole('button',{name:'닫기',exact:true}).click();console.log('PASS EQ controls');
  await page.getByRole('button',{name:'미니 플레이어',exact:true}).click();
  let mini;for(let i=0;i<20;i++){mini=application.windows().find(w=>w!==page);if(mini)break;await page.waitForTimeout(100);}
  assert.ok(mini);await mini.getByRole('button',{name:'일시정지'}).waitFor();await mini.getByRole('button',{name:'일시정지'}).click();await page.waitForFunction(()=>document.querySelector('audio').paused);console.log('PASS mini-player synchronization');
  await mini.getByRole('button',{name:'미니 플레이어 닫기'}).click().catch(error=>{if(!mini.isClosed())throw error;});
  assert.ok(mini.isClosed());await page.getByRole('heading',{name:'내 음악.'}).waitFor();
  await page.getByRole('button',{name:'취침 타이머',exact:true}).click();await page.getByRole('button',{name:'15분',exact:true}).click();console.log('PASS sleep timer setting');
  await page.getByRole('button',{name:'전체 재생',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0.1);
  assert.equal(await page.locator('.now-playing strong').textContent(),'검증 음악 B');
  await page.getByRole('slider',{name:'재생 위치'}).fill('11.8');
  await page.waitForFunction(()=>document.querySelector('.now-playing strong').textContent==='검증 음악 A');console.log('PASS automatic next at end of track');
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await page.getByRole('searchbox').count().catch(()=>{});
  await page.getByRole('textbox',{name:'음악 검색'}).fill('음악 A');assert.equal(await page.getByRole('row').count(),2);await page.getByRole('textbox',{name:'음악 검색'}).fill('');console.log('PASS search');
  await page.screenshot({path:'test-results/library.png'});
  await page.setViewportSize({width:960,height:650});await page.screenshot({path:'test-results/compact.png'});
  await page.waitForTimeout(5500);
  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(saved.tracks.length,2);assert.ok(saved.tracks.find(t=>t.title==='검증 음악 A').favorite);assert.equal(saved.playlists[0].trackIds.length,1);assert.equal(saved.settings.eqPreset,'따뜻하게');
  await page.getByRole('slider',{name:'재생 위치'}).fill('6.2');
  await application.close();
  const finalSaved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.ok(finalSaved.playback.position>=6.1,'closing must flush the latest seek position');
  console.log('PASS final playback position saved on immediate app quit');
  page=await launch();await page.getByRole('button',{name:'검증 음악 A',exact:true}).waitFor();
  assert.equal(await page.getByRole('row').count(),3);assert.ok(await page.getByRole('button',{name:'검증 음악 A 좋아요 취소'}).count());assert.ok(await page.getByRole('button',{name:'밤 산책 1'}).count());
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);console.log('PASS restart persistence and no autoplay');
  assert.deepEqual(errors,[]);console.log('PASS no renderer exceptions');
}catch(error){await activePage?.screenshot({path:'test-results/failure.png'}).catch(()=>{});throw error;}
finally{await application?.close().catch(()=>{});await rm(dir,{recursive:true,force:true});}
