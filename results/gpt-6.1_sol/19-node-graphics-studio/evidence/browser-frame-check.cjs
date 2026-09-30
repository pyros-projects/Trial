const assert=require('assert'),h=require('./browser-helper.cjs');const result=[];
try{
 const before=h.read('studio.state.project.graph.nodes.find(n=>n.id===11)');
 const p=h.box('[data-frame="flow"]');h.drag(p,{x:p.x+25,y:p.y+25});
 const after=h.read('studio.state.project.graph.nodes.find(n=>n.id===11)');
 h.cmd('focus','#graphStage');h.cmd('press','Control+z');
 assert(after.x!==before.x||after.y!==before.y,'Dragging the default frame must also move its Blend member.');
 assert(h.read('studio.state.project.graph.frames[0].nodes.every(id=>Number.isInteger(id))'));
 result.push('PASS Default frame moves its Blend member with the other nodes and all member IDs are numeric.');
}catch(e){result.push('FAIL '+e.stack);process.exitCode=1;}
h.save(process.argv.includes('--red')?'frame-red.log':'frame-green.log',result);console.log(result.join('\n'));
