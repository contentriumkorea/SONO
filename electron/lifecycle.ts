export function createExitFlusher(requestFinalState:()=>Promise<void>,getPendingSave:()=>Promise<void>):()=>Promise<void>{
  let inFlight:Promise<void>|null=null;
  return ()=>{
    if(!inFlight)inFlight=(async()=>{await requestFinalState();await getPendingSave();})().finally(()=>{inFlight=null;});
    return inFlight;
  };
}
