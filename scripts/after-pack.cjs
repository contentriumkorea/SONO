// Keep the executable required by installed SONO update helpers inside MusicBoard.app.
const {rename,access}=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
module.exports=async context=>{
  if(context.electronPlatformName!=='darwin')return;
  const contents=path.join(context.appOutDir,'MusicBoard.app','Contents');
  const previous=path.join(contents,'MacOS','MusicBoard'),executable=path.join(contents,'MacOS','SONO');
  try{await rename(previous,executable);}catch(error){if(error.code!=='ENOENT')throw error;await access(executable);}
  await promisify(execFile)('/usr/bin/plutil',['-replace','CFBundleExecutable','-string','SONO',path.join(contents,'Info.plist')]);
};
