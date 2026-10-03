import { useEffect,useRef,useState } from 'react';

export function FadeControl({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState('');
  const input=useRef<HTMLInputElement>(null),active=useRef(false),button=useRef<HTMLButtonElement>(null),returnFocus=useRef(false);
  const seconds=Number(draft),valid=draft.trim()!==''&&Number.isFinite(seconds)&&seconds>=0&&seconds<=5;
  useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}else if(returnFocus.current){returnFocus.current=false;button.current?.focus();}},[editing]);
  const edit=()=>{active.current=true;setDraft(value.toFixed(2));setEditing(true);};
  const finish=(save:boolean,focus=false)=>{
    if(!active.current)return;
    active.current=false;returnFocus.current=focus;if(save&&valid)onChange(Math.round(seconds*100)/100);setEditing(false);
  };
  return <div className="fade-setting"><div className="fade-setting-heading"><span>{label}</span>
    {editing?<div className="fade-value-input"><input ref={input} aria-label={`${label} 초`} aria-invalid={!valid} type="number" min="0" max="5" step="0.01" value={draft} onChange={event=>setDraft(event.target.value)}
      onBlur={()=>finish(true)} onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false,true);}
        else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(valid)finish(true,true);else input.current?.reportValidity();}
      }}/><span>초</span></div>:
    <button ref={button} type="button" className="fade-value" aria-label={`${label} 초 직접 입력`} title="더블클릭하여 직접 입력 (0–5초)" onDoubleClick={edit} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();edit();}}}>{value.toFixed(2)}초</button>}
  </div><input aria-label={`${label} 시간`} type="range" min="0" max="5" step="0.01" value={value} onChange={event=>onChange(Number(event.target.value))}/>
  <span className="fade-input-hint">{editing&&!valid?'0–5초 사이의 숫자를 입력해주세요.':'초 표시를 더블클릭하면 직접 입력할 수 있습니다.'}</span></div>;
}
