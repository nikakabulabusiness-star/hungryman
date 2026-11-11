let stopCurrent:(()=>void)|null=null;
let recording=false;
export function claimAudio(stop:()=>void){stopCurrent?.();stopCurrent=stop;return()=>{if(stopCurrent===stop)stopCurrent=null}}
export function setRecording(value:boolean){recording=value;if(value){stopCurrent?.();stopCurrent=null}}
export function isRecording(){return recording}
export function audioBusy(){return recording||!!stopCurrent}
