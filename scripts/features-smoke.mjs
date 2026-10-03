import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp,mkdir,writeFile,readFile,rm,readdir,access,realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd();
const dir=await realpath(await mkdtemp(path.join(tmpdir(),'sono-features-'))),data=path.join(dir,'data'),folder=path.join(dir,'입장곡');
await mkdir(data);await mkdir(folder);await mkdir('test-results',{recursive:true});
function wave(){
  const rate=16000,size=rate*2*12,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);
  for(let i=0;i<size/2;i++){const time=i/rate,amp=time<2?0:time<4?.2:time<6?.85:time<8?.1:.4;b.writeInt16LE(Math.round(Math.sin(i/rate*440*Math.PI*2)*amp*32767),44+i*2);}return b;
}
const files=['A','B'].map(n=>path.join(folder,`${n}.wav`)),added=['C','D','E'].map(n=>path.join(dir,`${n}.wav`));
for(const file of [...files,...added])await writeFile(file,wave());
const initial={version:1,tracks:[],folders:[{id:'empty',name:'빈 목적지'}],playlists:[],settings:{volume:.4,eqEnabled:false,eq:Array(20).fill(0),preamp:0,eqPreset:'Flat'},playback:{currentId:null,anchorId:null,position:0,queue:[],order:[],repeat:'off',shuffle:false}};
await writeFile(path.join(data,'state.json'),JSON.stringify(initial));
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const executable=process.env.SONO_SMOKE_EXECUTABLE;
const options={executablePath:executable||require('electron'),args:executable?[]:[root],env};
let app,page,cdp;const errors=[];
const button=name=>page.getByRole('button',{name,exact:true});
const row=name=>page.locator('[data-track-id]').filter({has:button(name)});
const titles=()=>page.locator('.track-title').allTextContents();
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();cdp=await app.context().newCDPSession(page);}
async function drop(files,target,fraction=.5,finish=true){
  await target.scrollIntoViewIfNeeded();
  const box=await target.boundingBox(),params={x:box.x+Math.min(100,box.width/2),y:box.y+box.height*fraction,data:{items:[],files,dragOperationsMask:1}};
  await cdp.send('Input.dispatchDragEvent',{...params,type:'dragEnter'});await cdp.send('Input.dispatchDragEvent',{...params,type:'dragOver'});
  if(finish){await cdp.send('Input.dispatchDragEvent',{...params,type:'drop'});await page.waitForFunction(()=>!document.querySelector('.import-progress'));}
  else await cdp.send('Input.dispatchDragEvent',{...params,type:'dragCancel'});
}
try{
  await launch();await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},files);
  await button('첫 음악 가져오기').click();await button('B').waitFor();await page.getByRole('combobox',{name:'음악 정렬'}).selectOption('title');
  await drop([added[0]],row('A'),.75);await button('C').waitFor();assert.deepEqual(await titles(),['A','C','B']);
  assert.equal(await page.getByRole('combobox',{name:'음악 정렬'}).inputValue(),'manual');assert.equal(await page.locator('.folder-group-heading').count(),2);
  await drop([added[1]],page.locator('.folder-group-heading').filter({has:page.locator('strong',{hasText:'입장곡'})}));await button('D').waitFor();
  assert.deepEqual(await titles(),['D','A','C','B']);
  await drop([added[2]],page.locator('[data-folder-id="empty"]'));await button('E').waitFor();assert.deepEqual(await titles(),['E','D','A','C','B']);
  console.log('PASS actual file drops insert after a visible song, at a folder header, and into an empty named folder; manual ordering and no ghost folders');
  await drop([added[0]],row('B'),.75);await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('0곡'));
  assert.deepEqual(await titles(),['E','D','A','B','C']);assert.equal((await page.evaluate(async()=> (await window.luma.getState()).state.tracks)).length,5);
  console.log('PASS dropping an existing file repositions it without duplicates or changing the original file');
  await button('A 재생').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>.1);
  await page.getByRole('img',{name:'음원 파형',exact:true}).waitFor();await button('A 일시정지').click();await page.waitForFunction(()=>document.querySelector('audio').paused);
  const heights=await page.locator('.waveform-remaining rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));
  assert.equal(heights.length,160);assert.equal(heights[5],1);assert.ok(heights[65]>heights[35]*3);assert.ok(heights[65]>heights[95]*5);
  const seek=page.getByRole('slider',{name:'재생 위치'});await seek.fill('5');assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-5)<.2);
  const box=await page.locator('.waveform-seek').boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height/2);
  assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-6)<.3);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height/2,{steps:6});await page.mouse.up();
  assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('audio').currentTime)-9)<.3);
  await seek.focus();await page.keyboard.press('ArrowLeft');assert.ok(await page.evaluate(()=>document.querySelector('audio').currentTime)<9.1);
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  assert.ok((await readdir(path.join(data,'waveforms'))).some(n=>n.endsWith('.json')));
  // Force an uncached response for B to exercise the Web Audio decoder on real bytes.
  // PCM WAV normally uses the streaming native path tested above.
  const bid=await row('B').getAttribute('data-track-id');
  const info=await page.evaluate(id=>window.luma.getWaveform(id),bid);
  await app.evaluate(({ipcMain},info)=>{ipcMain.removeHandler('waveform:get');ipcMain.handle('waveform:get',()=>({...info,peaks:null}));},info);
  await page.evaluate(()=>{const fetcher=window.fetch.bind(window);window.waveformFetches=0;window.fetch=(url,options)=>{if(String(url).startsWith('luma://audio/'))window.waveformFetches++;return fetcher(url,options);};});
  await button('B 재생').click();await page.waitForFunction(()=>window.waveformFetches>0&&document.querySelector('[data-waveform-state="ready"]'));
  await button('B 일시정지').click();await page.waitForFunction(()=>document.querySelector('audio').paused);
  const decodedHeights=await page.locator('.waveform-remaining rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));
  assert.equal(decodedHeights[5],1);assert.ok(decodedHeights[65]>decodedHeights[35]*3);
  console.log('PASS actual Web Audio decoding and source-byte fetch, in addition to the native PCM streaming path');
  await page.locator('.content').evaluate(el=>el.scrollTop=0);await seek.blur();
  await page.screenshot({path:'test-results/SONO-waveform.png'});
  console.log('PASS real PCM waveform silence/quiet/loud sections, cache, range/click/drag/keyboard seeking and paused state');
  await button('재생목록 만들기').click();await page.getByPlaceholder('예: 밤 산책, 집중할 때').fill('시험 목록');await button('만들기').click();
  await drop([files[0]],page.locator('.topbar'));await button('A').waitFor();
  await drop([files[1]],row('A'),.25);await button('B').waitFor();assert.deepEqual(await titles(),['B','A']);
  await drop([added[0]],row('A'),.75);await button('C').waitFor();assert.deepEqual(await titles(),['B','A','C']);
  console.log('PASS playlist external imports at specific edges, including already imported library files');
  await app.close();app=undefined;await launch();
  await button('A').waitFor();assert.deepEqual(await titles(),['E','D','A','B','C']);
  await page.getByRole('img',{name:'음원 파형',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  await page.setViewportSize({width:960,height:650});await page.screenshot({path:'test-results/SONO-waveform-compact.png'});
  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.deepEqual(saved.playlists.find(p=>p.name==='시험 목록').trackIds.map(id=>saved.tracks.find(t=>t.id===id).title),['B','A','C']);
  for(const file of [...files,...added])await access(file);assert.deepEqual(errors,[]);
  console.log('PASS order/folder/playlist/waveform persistence after restart, compact UI, no autoplay and original file retention');
}finally{if(app)await app.close();await rm(dir,{recursive:true,force:true});}
