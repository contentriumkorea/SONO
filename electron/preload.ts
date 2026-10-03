import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppState, LiveState, PlayerCommand } from '../src/shared/types';
const listen=(channel:string,callback:(value:any)=>void)=>{const listener=(_event:unknown,value:unknown)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
contextBridge.exposeInMainWorld('luma',{
  getWaveform:(id:string)=>ipcRenderer.invoke('waveform:get',id),
  saveWaveform:(id:string,key:string,peaks:number[])=>ipcRenderer.invoke('waveform:save',id,key,peaks),
  getUpdateState:()=>ipcRenderer.invoke('update:get'),
  checkForUpdates:()=>ipcRenderer.invoke('update:check'),
  downloadUpdate:()=>ipcRenderer.invoke('update:download'),
  installUpdate:()=>ipcRenderer.invoke('update:install'),
  onUpdate:(cb:(s:unknown)=>void)=>listen('update:state',cb),
  getState:()=>ipcRenderer.invoke('state:get'),
  saveState:(state:AppState)=>ipcRenderer.invoke('state:save',state),
  removeMusic:(ids:string[])=>ipcRenderer.invoke('music:remove',ids),
  importMusic:(mode:string)=>ipcRenderer.invoke('music:import',mode),
  importDroppedFiles:(files:File[])=>{
    const paths=files.map(file=>webUtils.getPathForFile(file)).filter(Boolean);
    if(!paths.length)return Promise.reject(new Error('컴퓨터에 저장된 음악 파일이나 폴더를 놓아주세요.'));
    return ipcRenderer.invoke('music:drop',paths);
  },
  importPlaylist:()=>ipcRenderer.invoke('playlist:import'),
  exportPlaylist:(id:string)=>ipcRenderer.invoke('playlist:export',id),
  showMini:()=>ipcRenderer.invoke('mini:show'),
  closeMini:()=>ipcRenderer.invoke('mini:close'),
  publishLive:(state:LiveState)=>ipcRenderer.send('player:live',state),
  playerCommand:(command:PlayerCommand)=>ipcRenderer.send('player:command',command),
  onLive:(cb:(s:LiveState)=>void)=>listen('player:live',cb),
  onCommand:(cb:(s:PlayerCommand)=>void)=>listen('player:command',cb),
  onProgress:(cb:(s:unknown)=>void)=>listen('import:progress',cb),
  onFlush:(cb:()=>void)=>listen('state:flush',cb),
  flushDone:()=>ipcRenderer.send('state:flushed'),
  windowAction:(action:string)=>ipcRenderer.send('window:action',action),
  platform:process.platform
});
