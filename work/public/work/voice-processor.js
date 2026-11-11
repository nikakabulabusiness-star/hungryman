/* Mono PCM at 16 kHz. Chunked capture runs off the UI thread. */
class VoiceProcessor extends AudioWorkletProcessor {
 constructor(){super();this.samples=[];this.phase=0;this.total=0;this.done=false;this.port.onmessage=e=>{if(e.data==='stop'){this.flush();this.done=true;this.port.postMessage({done:true})}}}
 flush(){if(!this.samples.length)return;const chunk=Float32Array.from(this.samples);this.samples=[];this.port.postMessage({samples:chunk},[chunk.buffer])}
 process(inputs){if(this.done)return false;const input=inputs[0]?.[0];if(input){for(let i=0;i<input.length;i++){this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;this.samples.push(input[i]);this.total++}if(this.total>=16000*300){this.flush();this.done=true;this.port.postMessage({done:true});return false}}if(this.samples.length>=4000)this.flush()}return true}
}
registerProcessor('hmw-voice',VoiceProcessor);
