import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),root=process.cwd();
const dir=await mkdtemp(path.join(tmpdir(),'sono-delete-')),data=path.join(dir,'data');
await mkdir(data);await mkdir('test-results',{recursive:true});
const files=['곡 A','곡 B','곡 C','곡 D'].map(name=>path.join(dir,`${name}.wav`));
function wave(){
  const size=44100*2*60,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}
for(const file of files)await writeFile(file,wave());
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const executable=process.env.SONO_SMOKE_EXECUTABLE;
const options={executablePath:executable||require('electron'),args:executable?[]:[root],env};
let app,page;const errors=[];
const button=name=>page.getByRole('button',{name,exact:true});
const titles=()=>page.locator('.track-title').allTextContents();
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
try{
  await launch();
  await app.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths});},files);
  await button('첫 음악 가져오기').click();await button('곡 D').waitFor();
  await page.getByRole('combobox',{name:'음악 정렬'}).selectOption('title');
  await button('곡 A').click();
  await page.keyboard.press('Backspace');
  await button('곡 A').waitFor({state:'detached'});
  assert.deepEqual(await titles(),['곡 B','곡 C','곡 D']);
  console.log('PASS Mac Delete (Backspace) removes only the selected song');

  await button('곡 C 재생').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);
  const source=await page.locator('audio').getAttribute('src');
  await button('곡 C').click();
  await button('곡 B 더 보기').click();await button('보관함에서 제거').click();
  await button('곡 B').waitFor({state:'detached'});
  assert.deepEqual(await titles(),['곡 C','곡 D']);
  assert.equal(await page.locator('audio').getAttribute('src'),source);
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),false);
  assert.equal(await page.locator('.track-row.is-selected .track-title').textContent(),'곡 C');
  console.log('PASS individual menu removes its own song and preserves other selection/playback');

  const search=page.getByRole('textbox',{name:'음악 검색'});
  await search.fill('곡');await page.keyboard.press('Backspace');
  assert.equal(await search.inputValue(),'');
  assert.deepEqual(await titles(),['곡 C','곡 D']);
  await button('곡 C 더 보기').click();await button('이름 변경').click();
  const rename=page.getByRole('textbox',{name:'새 이름'});
  await rename.fill('이름');await page.keyboard.press('Backspace');
  assert.equal(await rename.inputValue(),'이');
  await button('취소').click();
  assert.deepEqual(await titles(),['곡 C','곡 D']);
  console.log('PASS Backspace edits search/rename without removing songs');

  await button('재생목록 만들기').click();
  await page.getByRole('textbox',{name:'이름',exact:true}).fill('삭제 확인');await button('만들기').click();
  await page.locator('.main-nav').getByRole('button',{name:'내 음악',exact:false}).click();
  for(const name of ['곡 C','곡 D']){
    await button(`${name} 더 보기`).click();await button('재생목록에 추가').click();
    await page.getByRole('dialog').getByRole('button',{name:'삭제 확인',exact:false}).click();
  }
  await page.locator('.playlist-nav').getByRole('button',{name:'삭제 확인',exact:false}).click();
  await button('곡 D 더 보기').click();await button('목록에서 제거').click();
  await button('곡 D').waitFor({state:'detached'});
  await button('곡 C').click();await page.keyboard.press('Backspace');
  await button('곡 C').waitFor({state:'detached'});
  await page.getByRole('button',{name:'내 음악',exact:false}).first().click();
  assert.deepEqual(await titles(),['곡 C','곡 D']);
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),false);
  console.log('PASS playlist menu/Backspace keep songs in the library and keep playback');

  await button('곡 C 더 보기').click();await button('보관함에서 제거').click();
  await button('곡 C').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  assert.equal(await page.locator('audio').getAttribute('src'),null);
  await page.screenshot({path:'test-results/SONO-delete.png'});
  await app.close();
  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.equal(saved.tracks.length,1);assert.equal(saved.tracks[0].title,'곡 D');
  assert.equal(saved.playlists[0].trackIds.length,0);assert.equal(saved.playback.currentId,null);
  for(const file of files)await access(file);
  await launch();assert.deepEqual(await titles(),['곡 D']);
  await button('곡 D').click();await page.keyboard.press('Delete');
  await button('첫 음악 가져오기').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS current-song removal, saved state/restart, Windows Delete, and original files retained');
}catch(error){await page?.screenshot({path:'test-results/delete-failure.png'}).catch(()=>{});throw error;}
finally{await app?.close().catch(()=>{});await rm(dir,{recursive:true,force:true});}
