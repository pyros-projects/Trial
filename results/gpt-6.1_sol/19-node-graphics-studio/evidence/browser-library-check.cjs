const h=require('./browser-helper.cjs'),assert=require('assert'),fs=require('fs');const result=[];
try{
 const nodes=h.read('Object.keys(DEFS).map((t,i)=>makeNode(t,i+1,(i%6)*220,Math.floor(i/6)*215))');
 const fixture={version:1,name:'Complete node library validation',graph:{nodes,edges:[],frames:[]},keys:[],timeline:{duration:4,fps:30,time:1.2,loop:true},settings:{resolution:128,adaptive:false}};fs.writeFileSync('evidence/complete-library-project.json',JSON.stringify(fixture,null,2));
 h.cmd('upload','#projectFile','evidence/complete-library-project.json');h.cmd('wait','--fn','studio.state.project.name==="Complete node library validation"&&!dirty&&!structural');h.cmd('click','#fitGraph');
 for(const n of nodes){if(n.id===1)h.cmd('click',`#node-${n.id} .node-head`);else h.render(()=>h.cmd('click',`#node-${n.id} .node-head`));if(h.read('studio.state.previewTarget')===null)h.render(()=>h.cmd('click','#inspectPreview'));assert.equal(h.read('studio.state.previewTarget'),n.id);assert.equal(h.read('studio.diagnostics().status'),'valid');assert.equal(h.read('gl.getError()'),0);result.push('PASS Live intermediate GPU compilation and output for '+n.type+' #'+n.id);}
 assert(h.read('studio.diagnostics().programs')<=20);h.cmd('screenshot','evidence/screenshots/34-complete-node-library.png');result.push('PASS 41 visible editable nodes remain interactive and program cache stays within 20 entries.');
}catch(e){result.push('FAIL '+e.stack);process.exitCode=1;}h.save('complete-library.log',result);console.log(result.join('\n'));
