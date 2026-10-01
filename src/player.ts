import { EQ_FREQUENCIES } from './shared/library';
import type { Settings } from './shared/types';
export class AudioPlayer {
  readonly audio=document.createElement('audio');
  private context:AudioContext|null=null;
  private filters:BiquadFilterNode[]=[];
  private gain:GainNode|null=null;
  private fadeGain:GainNode|null=null;
  private transitionTimer:ReturnType<typeof setTimeout>|null=null;
  private transitionId=0;
  private pausing=false;
  private endFading=false;
  private pendingLoad:{id:string;position:number;autoplay:boolean}|null=null;
  private settings:Settings|null=null;
  private metadataCallback:(()=>void)|null=null;
  onEnded:()=>void=()=>{};
  onChange:()=>void=()=>{};
  onError:(message:string)=>void=()=>{};
  constructor(){
    this.audio.crossOrigin='anonymous';this.audio.preload='metadata';this.audio.hidden=true;document.body.append(this.audio);
    for(const event of ['timeupdate','play','pause','loadedmetadata','durationchange'])this.audio.addEventListener(event,()=>this.onChange());
    this.audio.addEventListener('timeupdate',()=>this.fadeAtEnd());
    this.audio.addEventListener('ended',()=>{
      this.endFading=false;
      if(this.pendingLoad){const pending=this.pendingLoad;const autoplay=pending.autoplay&&!this.pausing;this.cancelTransition();this.pausing=false;this.replaceSource(pending.id,pending.position,autoplay);return;}
      if(!this.pausing)this.onEnded();
    });
    this.audio.addEventListener('error',()=>{this.onError('이 곡을 재생할 수 없습니다. 파일 위치 또는 음악 형식을 확인해주세요.');this.onChange();});
  }
  private ensureGraph(){
    if(this.context)return;
    this.context=new AudioContext();const source=this.context.createMediaElementSource(this.audio);
    this.filters=EQ_FREQUENCIES.map(freq=>{const filter=this.context!.createBiquadFilter();filter.type='peaking';filter.frequency.value=Math.min(freq,this.context!.sampleRate/2-1);filter.Q.value=1.4;return filter;});
    this.gain=this.context.createGain();let previous:AudioNode=source;
    for(const filter of this.filters){previous.connect(filter);previous=filter;}
    this.fadeGain=this.context.createGain();
    previous.connect(this.gain);this.gain.connect(this.fadeGain);this.fadeGain.connect(this.context.destination);
    if(this.settings)this.setEQ(this.settings);
  }
  load(id:string,position=0,autoplay=false){
    const token=this.cancelTransition();this.pendingLoad=null;this.pausing=false;this.endFading=false;
    const replace=()=>{if(token===this.transitionId){const pending=this.pendingLoad;this.replaceSource(pending?.id??id,pending?.position??position,pending?.autoplay??autoplay);}};
    if(!this.audio.paused&&this.fadeGain&&(this.settings?.fadeOut??0.35)>0){
      this.pendingLoad={id,position,autoplay};
      const seconds=this.settings?.fadeOut??0.35;this.ramp(0,seconds);
      this.transitionTimer=setTimeout(replace,seconds*1000);
    }else replace();
  }
  private replaceSource(id:string,position:number,autoplay:boolean){
    this.transitionTimer=null;this.pendingLoad=null;
    if(this.metadataCallback)this.audio.removeEventListener('loadedmetadata',this.metadataCallback);
    this.audio.pause();this.audio.src=`luma://audio/${id}`;
    this.metadataCallback=()=>{this.metadataCallback=null;if(position>0)this.seek(position);if(autoplay)void this.play();};
    this.audio.addEventListener('loadedmetadata',this.metadataCallback,{once:true});
    this.audio.load();
  }
  async play(){
    if(this.pendingLoad){const pending=this.pendingLoad;this.cancelTransition();this.pausing=false;this.replaceSource(pending.id,pending.position,true);return;}
    const token=this.cancelTransition();const starting=this.audio.paused;
    this.pausing=false;this.endFading=false;
    try{
      this.ensureGraph();await this.context!.resume();if(token!==this.transitionId)return;
      if(starting)this.ramp(0,0);
      await this.audio.play();if(token!==this.transitionId)return;
      this.ramp(1,this.settings?.fadeIn??0.35);this.onChange();
    }
    catch(error){if((error as Error).name!=='AbortError')this.onError('재생을 시작하지 못했습니다. 다른 곡을 선택해주세요.');}
  }
  get playing(){return !this.audio.paused&&!this.pausing;}
  pause(){
    const pending=this.pendingLoad;const token=this.cancelTransition();this.pausing=true;this.onChange();
    const finish=()=>{if(token!==this.transitionId)return;this.transitionTimer=null;if(pending)this.replaceSource(pending.id,pending.position,false);else this.audio.pause();this.pausing=false;this.onChange();};
    const seconds=this.settings?.fadeOut??0.35;
    if(this.audio.paused||!this.fadeGain||!seconds){finish();return;}
    this.ramp(0,seconds);
    this.transitionTimer=setTimeout(finish,seconds*1000);
  }
  private cancelTransition(){
    if(this.transitionTimer)clearTimeout(this.transitionTimer);this.transitionTimer=null;
    return ++this.transitionId;
  }
  private ramp(value:number,seconds:number){
    if(!this.fadeGain||!this.context)return;
    const parameter=this.fadeGain.gain;const now=this.context.currentTime;
    parameter.cancelAndHoldAtTime(now);
    if(seconds>0)parameter.linearRampToValueAtTime(value,now+seconds);else parameter.setValueAtTime(value,now);
  }
  private fadeAtEnd(){
    const remaining=this.audio.duration-this.audio.currentTime;const seconds=this.settings?.fadeOut??0.35;
    if(this.playing&&!this.endFading&&seconds>0&&remaining>0&&remaining<=seconds){this.endFading=true;this.ramp(0,remaining);}
  }
  seek(seconds:number){
    if(this.pendingLoad){this.pendingLoad.position=Math.max(0,seconds);return;}
    if(Number.isFinite(this.audio.duration))this.audio.currentTime=Math.max(0,Math.min(seconds,this.audio.duration));
    if(this.endFading){this.endFading=false;if(this.playing)this.ramp(1,0.03);}
    this.fadeAtEnd();
  }
  setVolume(volume:number){this.audio.volume=volume;}
  setEQ(settings:Settings){
    this.settings=settings;
    this.filters.forEach((filter,i)=>filter.gain.setTargetAtTime(settings.eqEnabled?settings.eq[i]:0,this.context!.currentTime,0.015));
    if(this.gain)this.gain.gain.setTargetAtTime(settings.eqEnabled?Math.pow(10,settings.preamp/20):1,this.context!.currentTime,0.015);
  }
  clear(){this.cancelTransition();this.pendingLoad=null;this.pausing=false;this.endFading=false;if(this.metadataCallback)this.audio.removeEventListener('loadedmetadata',this.metadataCallback);this.metadataCallback=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.onChange();}
  dispose(){this.clear();this.audio.remove();void this.context?.close();}
}
