const h=require('./browser-helper.cjs'),fs=require('fs'),assert=require('assert');const result=[];
const fixture={version:1,name:'Alpha mask validation',graph:{nodes:[{id:1,type:'Color',x:0,y:0,params:{color:[.1,.2,.3,.2],alpha:1}},{id:2,type:'Color',x:0,y:230,params:{color:[.8,.6,.4,.8],alpha:1}},{id:3,type:'Blend',x:250,y:80,params:{mask:0,mode:'screen'}},{id:4,type:'Output',x:500,y:80,params:{}}],edges:[{from:1,out:0,to:3,input:0},{from:2,out:0,to:3,input:1},{from:3,out:0,to:4,input:0}],frames:[]},keys:[],timeline:{duration:4,fps:30,time:0,loop:true},settings:{resolution:128,colorSpace:'linear',adaptive:false}};
fs.writeFileSync('evidence/alpha-blend-project.json',JSON.stringify(fixture,null,2));
function pixel(){return h.read('[...document.querySelector("#previewCanvas").getContext("2d").getImageData(64,64,1,1).data]');}
try{
 h.cmd('upload','#projectFile','evidence/alpha-blend-project.json');h.cmd('wait','--fn','studio.state.project.name==="Alpha mask validation"&&!dirty&&!structural');assert(Math.abs(pixel()[3]-51)<=1,'Zero mask must preserve base alpha .2: observed '+pixel());result.push('PASS Zero mask preserves base alpha .2 rather than layer alpha .8.');
 h.cmd('click','#fitGraph');h.cmd('click','#node-3 .node-head');h.cmd('click','[data-inspector="node"]');
 for(const mode of ['mix','multiply','screen','add','difference']){
  h.render(()=>h.cmd('select','#param-mode',mode));h.render(()=>{h.cmd('fill','#param-mask','0');h.cmd('press','Tab');});let p=pixel();assert(Math.abs(p[3]-51)<=1);
  h.render(()=>{h.cmd('fill','#param-mask','1');h.cmd('press','Tab');});p=pixel();const b=[.1,.2,.3],c=[.8,.6,.4],outA=.8+.2*(1-.8),blend=b.map((v,i)=>mode==='mix'?c[i]:mode==='multiply'?v*c[i]:mode==='screen'?1-(1-v)*(1-c[i]):mode==='add'?v+c[i]:Math.abs(v-c[i]));const expected=b.map((v,i)=>Math.round(((1-.8)*.2*v+.8*(1-.2)*c[i]+.8*.2*blend[i])/outA*255));assert(Math.abs(p[3]-Math.round(outA*255))<=1);assert(expected.every((v,i)=>Math.abs(v-p[i])<=3),'Color mismatch '+mode+': '+p+' vs '+expected);result.push('PASS '+mode+' masks 0/1 preserve/mix RGBA correctly, observed '+p+' at full mask.');
 }
 assert.equal(h.read('gl.getError()'),0);
}catch(e){result.push('FAIL '+e.stack);process.exitCode=1;}h.save(process.argv.includes('--red')?'blend-alpha-red.log':'blend-alpha-green.log',result);console.log(result.join('\n'));
