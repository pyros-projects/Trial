$('#graphArea').addEventListener('pointerdown',e=>{if(e.button===2)return;
const port=e.target.closest('.port');
if(port){e.preventDefault();
e.stopPropagation();
const info={id:Number(port.dataset.id),port:Number(port.dataset.port),dir:port.dataset.dir};
if(e.altKey&&info.dir==='in'){disconnect(info.id,info.port);
return}if(pendingPort&&pendingPort.dir!==info.dir){const from=info.dir==='out'?info.id:pendingPort.id,to=info.dir==='in'?info.id:pendingPort.id,p=info.dir==='in'?info.port:pendingPort.port;
connect(from,to,p);
clearInteraction();
return}pendingPort={...info,point:graphPoint(e.clientX,e.clientY),startX:e.clientX,startY:e.clientY};
port.classList.add('pending');
interaction={kind:'wire',moved:false};
return}const collapse=e.target.closest('[data-collapse]');
if(collapse){e.stopPropagation();
checkpoint();
const n=project.nodes.find(n=>n.id===Number(collapse.dataset.collapse));
n.collapsed=!n.collapsed;
refreshGraph(false);
return}if(pendingPort){clearInteraction();
return}const nodeEl=e.target.closest('.node'),comment=e.target.closest('.comment');
if((spaceHeld||e.button===1)||(!nodeEl&&!comment&&!e.shiftKey)){if(!spaceHeld&&e.button!==1){selection.clear();
$$('.node').forEach(el=>el.classList.remove('selected'));
renderInspector()}interaction={kind:'pan',x:e.clientX,y:e.clientY,origX:view.x,origY:view.y};
$('#graphArea').style.cursor='grabbing'}
else if(comment){checkpoint();
const f=project.frames[Number(comment.dataset.comment)];
interaction={kind:'comment',x:e.clientX,y:e.clientY,f,ox:f.x,oy:f.y}}
else if(nodeEl){const id=Number(nodeEl.dataset.id);
if(e.shiftKey||!selection.has(id))selectNode(id,e.shiftKey);
if(e.target.closest('.node-head')){checkpoint();
interaction={kind:'move',x:e.clientX,y:e.clientY,orig:project.nodes.filter(n=>selection.has(n.id)).map(n=>({id:n.id,x:n.x,y:n.y}))}}
else if(e.shiftKey){const r=$('#graphArea').getBoundingClientRect();
interaction={kind:'box',x:e.clientX-r.left,y:e.clientY-r.top};
$('#selectionBox').hidden=false}if(interaction)e.preventDefault()});
