import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=process.cwd();
const dir=await mkdtemp(path.join(tmpdir(),'sono-organize-')),data=path.join(dir,'data');
const one=path.join(dir,'폴더 하나'),two=path.join(dir,'폴더 둘');
await mkdir(data);await mkdir(one);await mkdir(two);await mkdir('test-results',{recursive:true});
const files=[path.join(one,'곡 A.wav'),path.join(one,'곡 B.wav'),path.join(two,'곡 C.wav')];
function wave(){
  const size=44100*2*30,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;
}
for(const file of files)await writeFile(file,wave());
const env={...process.env,LUMA_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const packaged=process.argv.includes('--packaged');
const options={executablePath:packaged?path.join(root,'release','win-unpacked','SONO.exe'):require('electron'),args:packaged?[]:[root],env};
let app,page;const errors=[];
async function launch(){app=await electron.launch(options);page=await app.firstWindow();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'내 음악.'}).waitFor();}
const title=name=>page.getByRole('button',{name,exact:true});
const row=name=>page.locator('.track-row[draggable]').filter({has:title(name)});
const heading=name=>page.locator('.folder-group-heading').filter({has:page.locator('strong').filter({hasText:new RegExp(`^${name}$`)})});
async function groups(){return page.locator('.track-table').evaluate(el=>{
  const result={};let name;for(const child of el.children){if(child.classList.contains('folder-group-heading')){name=child.querySelector('strong').textContent;result[name]=[];}else if(child.querySelector('.track-title'))result[name].push(child.querySelector('.track-title').textContent);}return result;
});}
async function internalDrag(source,target,after=false){
  await source.scrollIntoViewIfNeeded();const start=await source.boundingBox();
  await page.mouse.move(start.x+8,start.y+12);await page.mouse.down();
  await page.mouse.move(start.x+43,start.y+12,{steps:5});
  await target.scrollIntoViewIfNeeded();const end=await target.boundingBox();
  await page.mouse.move(end.x+100,end.y+(after?end.height-6:20),{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('.is-dragging'));
}
async function rename(kind,oldName,name){
  if(kind==='folder')await page.getByRole('button',{name:`${oldName} 폴더 이름 변경`,exact:true}).click();
  else {await title(`${oldName} 더 보기`).click();await title('이름 변경').click();}
  await page.getByRole('textbox',{name:'새 이름'}).fill(name);await title('변경').click();await page.getByRole('dialog').waitFor({state:'hidden'});
}
try{
  await launch();
  await app.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths});},files);
  await title('첫 음악 가져오기').click();await title('곡 C').waitFor();
  assert.equal(await page.getByRole('checkbox').count(),0);assert.equal(await page.locator('.selection-toolbar').count(),0);
  assert.equal((await page.locator('body').textContent()).includes('알 수 없는 아티스트'),false);
  await title('곡 A 재생').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);
  const source=await page.locator('audio').getAttribute('src');
  await internalDrag(row('곡 A').locator('.drag-handle'),row('곡 C'),true);
  let grouped=await groups();assert.deepEqual(grouped['폴더 하나'],['곡 B']);assert.deepEqual(grouped['폴더 둘'],['곡 C','곡 A']);
  assert.equal(await page.locator('audio').getAttribute('src'),source);assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),false);
  console.log('PASS individual song moves to another folder while playback continues');
  await internalDrag(row('곡 B').locator('.drag-handle'),heading('폴더 둘'));
  grouped=await groups();assert.deepEqual(grouped['폴더 하나'],[]);assert.deepEqual(grouped['폴더 둘'],['곡 B','곡 C','곡 A']);
  await internalDrag(row('곡 B').locator('.drag-handle'),heading('폴더 하나'));
  grouped=await groups();assert.deepEqual(grouped['폴더 하나'],['곡 B']);
  console.log('PASS moving the last song and dropping into an empty folder');
  await title('곡 A').click();await title('곡 B').click({modifiers:['Control']});
  assert.equal(await page.locator('.track-row.is-selected').count(),2);
  await internalDrag(row('곡 A').locator('.drag-handle'),heading('폴더 둘'));
  grouped=await groups();assert.deepEqual(grouped['폴더 하나'],[]);assert.deepEqual(grouped['폴더 둘'],['곡 A','곡 B','곡 C']);
  await title('선택 해제').click();
  console.log('PASS Ctrl click selection and moving selected songs from multiple folders');
  await rename('track','곡 A','내 음악');await rename('folder','폴더 둘','좋아하는 폴더');
  await title('내 음악').waitFor();assert.deepEqual((await groups())['좋아하는 폴더'],['내 음악','곡 B','곡 C']);
  assert.equal(await page.locator('.now-playing strong').textContent(),'내 음악');
  const miniReady=app.waitForEvent('window');await title('미니 플레이어').click();
  const mini=await miniReady;await mini.waitForFunction(()=>document.querySelector('.mini-info strong')?.textContent==='내 음악');
  assert.equal(await mini.locator('.mini-info strong').textContent(),'내 음악');assert.equal((await mini.locator('body').textContent()).includes('알 수 없는 아티스트'),false);await mini.getByRole('button',{name:'미니 플레이어 닫기'}).click();
  const folderOrder=await page.locator('.folder-group-heading strong').allTextContents();
  await internalDrag(page.locator('.folder-group-heading').last().locator('.folder-drag-handle'),page.locator('.folder-group-heading').first());
  assert.deepEqual(await page.locator('.folder-group-heading strong').allTextContents(),[folderOrder[1],folderOrder[0]]);
  assert.deepEqual((await groups())['좋아하는 폴더'],['내 음악','곡 B','곡 C']);
  await page.screenshot({path:'test-results/SONO-organization.png'});
  await rename('folder','폴더 하나','빈 폴더');
  await app.close();
  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.equal(saved.tracks.find(t=>t.displayName==='내 음악').path,files[0]);
  assert.deepEqual(saved.folders.map(f=>f.name),['빈 폴더','좋아하는 폴더']);
  for(const file of files)await access(file);
  await launch();await title('내 음악').waitFor();assert.deepEqual((await groups())['좋아하는 폴더'],['내 음악','곡 B','곡 C']);assert.deepEqual((await groups())['빈 폴더'],[]);
  assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
  await internalDrag(row('내 음악').locator('.drag-handle'),heading('빈 폴더'));
  assert.deepEqual((await groups())['빈 폴더'],['내 음악']);
  await app.evaluate(({dialog},filePaths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths});},files);
  await title('음악 추가').click();await title('파일 가져오기').click();
  await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('0곡'));
  assert.deepEqual((await groups())['빈 폴더'],['내 음악']);assert.equal(await page.locator('.track-title').count(),3);
  assert.deepEqual(errors,[]);
  console.log('PASS song/folder rename, folder ordering, mini player names, restart and duplicate import persistence; original files retained');
  await internalDrag(row('내 음악').locator('.drag-handle'),heading('좋아하는 폴더'));
  await title('빈 폴더 빈 폴더 삭제').click();
  assert.equal(await heading('빈 폴더').count(),0);
  assert.equal(await title('좋아하는 폴더 빈 폴더 삭제').count(),0);
  assert.equal(await page.locator('.track-title').count(),3);
  await app.close();await launch();await title('내 음악').waitFor();assert.equal(await heading('빈 폴더').count(),0);
  console.log('PASS empty folder delete is saved and folders with songs cannot be deleted');
  await app.close();
  const stale=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  stale.folders.push({id:path.join(dir,'old-one'),name:'이전 빈 폴더 1'},{id:path.join(dir,'old-two'),name:'이전 빈 폴더 2'});
  await writeFile(path.join(data,'state.json'),JSON.stringify(stale));
  await launch();await title('빈 폴더 정리 (2)').waitFor();await title('빈 폴더 정리 (2)').click();
  assert.deepEqual(await page.locator('.folder-group-heading strong').allTextContents(),['좋아하는 폴더']);
  assert.equal(await page.locator('.track-title').count(),3);
  await title('내 음악').click();await page.keyboard.press('Control+a');await title('선택 삭제 (3)').click();
  await title('첫 음악 가져오기').waitFor();
  await app.close();
  const cleared=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  assert.deepEqual(cleared.tracks,[]);assert.deepEqual(cleared.folders,[]);
  for(const file of [...files,one,two])await access(file);
  await launch();await title('첫 음악 가져오기').waitFor();assert.equal(await page.getByRole('button',{name:/빈 폴더 정리/}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS stale empty folder cleanup, automatic cleanup on song deletion, restart persistence and original folders/files retained');
}catch(error){await page?.screenshot({path:'test-results/organization-failure.png'}).catch(()=>{});throw error;}
finally{await app?.close().catch(()=>{});await rm(dir,{recursive:true,force:true});}
