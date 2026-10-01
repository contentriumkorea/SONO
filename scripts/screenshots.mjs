import { _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const root=process.cwd();const dir=await mkdtemp(path.join(tmpdir(),'luma-visual-'));
await mkdir('test-results',{recursive:true});
const env={...process.env,LUMA_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;delete env.LUMA_DEV_URL;
const application=await electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:[root],env});
try{
  const page=await application.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'첫 음악 가져오기'}).waitFor();
  await page.screenshot({path:'test-results/color-contrast.png'});
  await page.getByRole('button',{name:'이퀄라이저',exact:true}).click();
  await page.screenshot({path:'test-results/color-contrast-eq.png'});
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.setViewportSize({width:960,height:650});await page.screenshot({path:'test-results/color-contrast-compact.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Visual checks passed: main, equalizer, 960px layout; no renderer exceptions.');
}finally{await application.close();await rm(dir,{recursive:true,force:true});}
