// Compatibility assets let already-installed SONO updaters reach MusicBoard.
import {readFile,copyFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),{version}=JSON.parse(await readFile('package.json','utf8'));
if(process.platform==='win32'){
  await copyFile(`release/MusicBoard-${version}-windows-x64-setup.exe`,`release/SONO-${version}-windows-x64-setup.exe`);
}else if(process.platform==='darwin'){
  await copyFile(`release/MusicBoard-${version}-mac-universal.dmg`,`release/SONO-${version}-mac-universal.dmg`);
  const dir=await mkdtemp(path.join(tmpdir(),'musicboard-legacy-'));
  try{
    const bundle=path.join(dir,'SONO.app');
    await exec('/usr/bin/ditto',[path.resolve('release/mac-universal/MusicBoard.app'),bundle]);
    await exec('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
    await exec('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',bundle,path.resolve(`release/SONO-${version}-mac-universal.zip`)]);
  }finally{await rm(dir,{recursive:true,force:true});}
}
