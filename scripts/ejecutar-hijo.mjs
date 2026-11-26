import {spawn} from 'node:child_process';

const [script,...args]=process.argv.slice(2);
if(!script)throw new Error('Falta el script que se debe ejecutar.');
const windows=process.platform==='win32';
const child=spawn(process.execPath,[script,...args],{stdio:'inherit',detached:!windows});
let finished=false,timedOut=false,killTimer;
const stop=()=>{
 if(!child.pid)return;
 try{if(windows)child.kill('SIGTERM');else process.kill(-child.pid,'SIGTERM');}catch{}
 killTimer=setTimeout(()=>{
  try{if(windows)child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');}catch{}
 },8000);
 killTimer.unref();
};
const timer=setTimeout(()=>{timedOut=true;console.error('TIEMPO AGOTADO: se termina el proceso y sus descendientes.');stop();},10*60*1000);
const finish=(code)=>{
 if(finished)return;finished=true;clearTimeout(timer);clearTimeout(killTimer);
 process.exit(timedOut?124:(code??1));
};
child.on('error',e=>{console.error(e);finish(1);});
child.on('close',(code)=>finish(code));
for(const signal of ['SIGINT','SIGTERM']){
 process.on(signal,()=>{stop();setTimeout(()=>finish(1),8500).unref();});
}
