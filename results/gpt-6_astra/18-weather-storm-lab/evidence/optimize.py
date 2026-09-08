from pathlib import Path
p=Path('evidence/render.js');s=p.read_text()
s=s.replace('sampler3D cloudTex,windTex;', 'sampler3D cloudTex,windTex,noiseTex;')
a=s.index('  float noise(vec3 p){');b=s.index('\n  float fbm(',a)
s=s[:a]+'  float noise(vec3 p){return texture(noiseTex,(p+.5)/32.).r;}'+s[b:]
s=s.replace("'terrainTex','cloudTex','windTex'", "'terrainTex','cloudTex','windTex','noiseTex'")
s=s.replace("this.n=0;this.l=0;this.uploads=0;this.renders=0;", "this.n=0;this.l=0;this.uploads=0;this.renders=0;const noiseData=new Uint8Array(32*32*32);let random=73591;for(let i=0;i<noiseData.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;noiseData[i]=random>>>24;}this.noiseTex=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_3D,this.noiseTex);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.REPEAT);gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,32,32,32,0,gl.RED,gl.UNSIGNED_BYTE,noiseData);")
s=s.replace('g.uniform1i(u.windTex,2);g.drawArrays', 'g.uniform1i(u.windTex,2);g.uniform1i(u.noiseTex,3);g.drawArrays')
p.write_text(s)
p=Path('evidence/app.js');s=p.read_text().replace('yaw:.58,pitch:.18,distance:27,target:[0,3.7,0]','yaw:.58,pitch:.14,distance:19.5,target:[-1,3.3,0]').replace("['Observatory',.58,.18,27,[0,3.7,0]]", "['Observatory',.58,.14,19.5,[-1,3.3,0]]")
s=s.replace('const elapsed=lastFrame?Math.min(.1,(now-lastFrame)/1000):.016;frameMs=frameMs*.93+elapsed*1000*.07;', 'const realElapsed=lastFrame?(now-lastFrame)/1000:.016,elapsed=Math.min(.1,realElapsed);frameMs=frameMs*.93+realElapsed*1000*.07;')
# Visible particles are projected from sampled numerical rain, transported by wind and sedimentation.
needle=" if(settings.vectors){for(let z="
insert=""" if(view===0&&mode===0&&settings.rainDensity>0){for(let i=0;i<Math.round(700*settings.rainDensity);i++){const rand=k=>{const a=Math.sin((i+1)*k+sim.seed*.001)*43758.5453;return a-Math.floor(a);};const baseX=(rand(12.9898)-.5)*30,baseZ=(rand(78.233)-.5)*30,phase=rand(45.13),base=sim.sample(baseX,3,baseZ),snow=base.temperature<0,fall=snow?.00010:.00075,y=(1-((phase+sim.time*fall)%1))*10;const x=baseX+Math.sin(phase*9+sim.time*.003)*.16,z=baseZ;const f=sim.sample(x,y,z);if(f.rain<.004||y<f.terrain+.12)continue;const alpha=clamp(f.rain*2.5,.035,.55);const a=project([x,y,z]);if(!a||a[0]<0||a[0]>w||a[1]<0||a[1]>h)continue;c.strokeStyle=`rgba(175,214,217,${alpha})`;c.fillStyle=`rgba(226,237,229,${alpha+.12})`;if(f.temperature<0){c.beginPath();c.arc(a[0],a[1],1.1,0,Math.PI*2);c.fill();}else{const b=project([x-f.u*.001,y+.16,z-f.v*.001]);if(b){c.lineWidth=.7;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}}}}\n"""
s=s.replace(needle,insert+needle)
p.write_text(s)
p=Path('index.html');s=p.read_text().replace('<select id="presetSelect">','<select id="presetSelect" aria-label="Storm preset">').replace('Advection is semi-Lagrangian.','Advection uses explicit upwind transport.');p.write_text(s)
