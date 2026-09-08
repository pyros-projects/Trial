from pathlib import Path
p=Path('evidence/render.js');s=p.read_text().replace('uniform vec2 res;','uniform vec2 res,mapCenter;').replace('rainDensity,sliceY,sliceZ,flash;','rainDensity,sliceY,sliceZ,flash,mapExtent;')
s=s.replace('ro=vec3(uv.x*aspect*18.,40.,-uv.y*18.);','ro=vec3(uv.x*aspect*mapExtent+mapCenter.x,40.,-uv.y*mapExtent+mapCenter.y);')
s=s.replace("['res','eye'", "['res','mapCenter','mapExtent','eye'")
s=s.replace('g.uniform2f(u.res,w,h);','g.uniform2f(u.res,w,h);g.uniform2fv(u.mapCenter,options.mapCenter);g.uniform1f(u.mapExtent,options.mapExtent);')
p.write_text(s)
p=Path('evidence/app.js');s=p.read_text()
s=s.replace('flyPitch:0,preset:0};','flyPitch:0,preset:0,mapZoom:1,mapCenter:[0,0]};')
s=s.replace('function project(p){', "function mapExtent(){return Math.max(18,18/(canvas.clientWidth/canvas.clientHeight))*camera.mapZoom;}\nfunction project(p){")
s=s.replace("if(view===1)return[(p[0]/(18*aspect)+1)*width/2,(1+p[2]/18)*height/2,1]", "if(view===1)return[((p[0]-camera.mapCenter[0])/(mapExtent()*aspect)+1)*width/2,(1+(p[2]-camera.mapCenter[1])/mapExtent())*height/2,1]")
s=s.replace('const x=nx*aspect*18,z=-ny*18;', 'const x=nx*aspect*mapExtent()+camera.mapCenter[0],z=-ny*mapExtent()+camera.mapCenter[1];')
s=s.replace('camera.distance=clamp(camera.distance*gesture.distance/Math.max(1,distance),9,90);pan(', 'if(view===1)camera.mapZoom=clamp(camera.mapZoom*gesture.distance/Math.max(1,distance),.35,2);else camera.distance=clamp(camera.distance*gesture.distance/Math.max(1,distance),9,90);pan(')
s=s.replace("else if(view===0){camera.yaw-=dx*.006;camera.pitch=clamp(camera.pitch+dy*.006,.04,1.5);}","else if(view===0){camera.yaw-=dx*.006;camera.pitch=clamp(camera.pitch+dy*.006,.04,1.5);}else if(view===1)pan(dx,dy);")
s=s.replace('function pan(dx,dy){if(view!==0)return;', 'function pan(dx,dy){if(view===1){camera.mapCenter[0]=clamp(camera.mapCenter[0]-dx*2*mapExtent()/canvas.clientHeight,-16,16);camera.mapCenter[1]=clamp(camera.mapCenter[1]-dy*2*mapExtent()/canvas.clientHeight,-16,16);return;}if(view!==0)return;')
s=s.replace("e.preventDefault();if(camera.fly){const b=basis();", "e.preventDefault();if(view===1){camera.mapZoom=clamp(camera.mapZoom*Math.exp(e.deltaY*.001),.35,2);}else if(camera.fly){const b=basis();")
s=s.replace('...basis(),scale:', '...basis(),mapExtent:mapExtent(),mapCenter:camera.mapCenter,scale:')
s=s.replace(" if(settings.vectors){for(let z=", " if(settings.vectors&&view!==2){for(let z=")
needle=" if(view!==2){const ground=sim.sample(probe.x,0,probe.z).terrain"
insert=""" if(settings.vectors&&view===2){for(let y=1;y<12;y+=2)for(let x=-12;x<=12;x+=4){const p=sim.sample(x,y,probe.z);if(y<p.terrain)continue;const a=project([x,y,probe.z]),b=project([x+p.u*.07,y+p.w*.10,probe.z]);c.strokeStyle='#d6efb599';c.lineWidth=1;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);c.lineTo(b[0]-4*Math.cos(angle-.5),b[1]-4*Math.sin(angle-.5));c.moveTo(b[0],b[1]);c.lineTo(b[0]-4*Math.cos(angle+.5),b[1]-4*Math.sin(angle+.5));c.stroke();}}\n"""
s=s.replace(needle,insert+needle)
s=s.replace(" $('compassSvg').style.transform=", " const scaleOrigin=[probe.x,sim.sample(probe.x,0,probe.z).terrain+.1,probe.z],scaleDirection=view===0?basis().rightV:[1,0,0],sa=project(scaleOrigin),sb=project(scaleOrigin.map((v,i)=>v+scaleDirection[i]));if(sa&&sb){const px=Math.hypot(sb[0]-sa[0],sb[1]-sa[1]);const length=[.5,1,2,4,8].filter(n=>n*px<70).at(-1)||.5;const bar=document.querySelector('.scale');bar.textContent=length+' km';bar.style.setProperty('--scale-width',Math.max(8,length*px)+'px');bar.title='Scale at the probe location';}\n $('compassSvg').style.transform=")
# Validate the entire optional UI envelope before replacing any live state; never assign extra keys.
s=s.replace("nextHistory=u.history;else throw new Error('Invalid probe history');}","nextHistory=u.history;else throw new Error('Invalid probe history');validateUIState(u,next.time);}")
a=s.index("if(u.effects&&['rng','count','lastAuto','manual','automatic']");b=s.index('mode=Number.isInteger(u.mode)',a)
s=s[:a]+"if(u.effects)for(const k of ['rng','count','lastAuto','manual','automatic'])effects[k]=u.effects[k];if(u.camera)for(const k of ['yaw','pitch','distance','target','fly','flyPos','flyYaw','flyPitch','preset','mapZoom','mapCenter'])if(k in u.camera)camera[k]=Array.isArray(u.camera[k])?u.camera[k].slice():u.camera[k];"+s[b:]
insert="""function validateUIState(u,time){
 const number=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 if(typeof u.paused!=='boolean'||!Number.isInteger(u.mode)||u.mode<0||u.mode>10||![0,1,2].includes(u.view))throw new Error('Invalid view state');
 if(!u.settings||typeof u.settings!=='object'||Array.isArray(u.settings))throw new Error('Invalid render settings');
 for(const key of ['renderScale','cloudQuality','rainDensity','exposure','timeOfDay','radius','strength'])if(!number(u.settings[key],defs[key][1],defs[key][2]))throw new Error('Invalid setting: '+key);
 if(!['low','balanced','high'].includes(u.settings.quality)||['adaptive','vectors'].some(k=>typeof u.settings[k]!=='boolean'))throw new Error('Invalid quality settings');
 const ca=u.camera,caKeys=['yaw','pitch','distance','target','fly','flyPos','flyYaw','flyPitch','preset','mapZoom','mapCenter'];
 if(!ca||typeof ca!=='object'||Object.keys(ca).some(k=>!caKeys.includes(k)))throw new Error('Invalid camera state');
 for(const [k,a,b] of [['yaw',-10000,10000],['pitch',.04,1.5],['distance',9,90],['flyYaw',-10000,10000],['flyPitch',-1.45,1.45],['preset',0,1e9]])if(!number(ca[k],a,b))throw new Error('Invalid camera '+k);
 if(typeof ca.fly!=='boolean'||!Number.isInteger(ca.preset)||['target','flyPos'].some(k=>!Array.isArray(ca[k])||ca[k].length!==3||ca[k].some(v=>!number(v,-50,50))))throw new Error('Invalid camera position');
 if('mapZoom'in ca&&!number(ca.mapZoom,.35,2))throw new Error('Invalid map zoom');
 if('mapCenter'in ca&&(!Array.isArray(ca.mapCenter)||ca.mapCenter.length!==2||ca.mapCenter.some(v=>!number(v,-16,16))))throw new Error('Invalid map center');
 const ef=u.effects,efKeys=['rng','count','lastAuto','manual','automatic'];
 if(!ef||typeof ef!=='object'||Object.keys(ef).some(k=>!efKeys.includes(k)))throw new Error('Invalid lightning state');
 for(const key of ['rng','count','manual','automatic'])if(!Number.isInteger(ef[key])||!number(ef[key],0,4294967295))throw new Error('Invalid lightning '+key);
 if(!number(ef.lastAuto,-100,time)||ef.count!==ef.manual+ef.automatic)throw new Error('Invalid lightning history');
}
"""
s=s.replace("$('stateFile').addEventListener('change'",insert+"$('stateFile').addEventListener('change'")
p.write_text(s)
p=Path('index.html');s=p.read_text().replace('width:67px;height:5px','width:var(--scale-width,67px);height:5px').replace('.scale:before{width:35px}', '.scale:before{width:var(--scale-width,35px)}');p.write_text(s)
