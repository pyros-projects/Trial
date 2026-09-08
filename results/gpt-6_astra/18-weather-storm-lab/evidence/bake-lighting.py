from pathlib import Path
p=Path('evidence/render.js');s=p.read_text()
s=s.replace('sampler3D cloudTex,windTex,noiseTex;', 'sampler3D cloudTex,windTex,noiseTex,lightTex;')
s=s.replace("float lit=exp(-density(p+sunDir*.8)*2.0-density(p+sunDir*1.8)*1.8-density(p+sunDir*3.8)*1.2);", "float lit=texture(lightTex,tc(p)).r;lit=clamp(lit*(.86+.28*noise(p*3.4)),.025,1.);")
s=s.replace("'windTex','noiseTex'", "'windTex','noiseTex','lightTex'")
s=s.replace('this.windTex=gl.createTexture();', 'this.windTex=gl.createTexture();this.lightTex=gl.createTexture();')
s=s.replace(' upload(sim){', ' upload(sim,timeOfDay=15.5){')
s=s.replace('this.windData=new Float32Array(N*4);', 'this.windData=new Float32Array(N*4);this.lightData=new Uint8Array(N);')
needle='  const setup=(unit,tex,target)=>'
insert="""  // Six-point optical-depth approximation through actual cloud water, evaluated once per model update.
  // Precomputing this coarse shadow field avoids three additional density ray samples per pixel.
  const angle=(timeOfDay-6)/12*Math.PI,sun=[Math.cos(angle)*.65,Math.max(-.4,Math.sin(angle)),.28],length=Math.hypot(...sun),sx=sun[0]/length*(sim.n-1)/32,sz=sun[2]/length*(sim.n-1)/32,sy=sun[1]/length*(sim.l-1)/12;
  for(let y=0;y<sim.l;y++)for(let z=0;z<sim.n;z++)for(let x=0;x<sim.n;x++){let optical=0;for(let k=1;k<=6;k++){const xx=Math.round(x+sx*k*.85),yy=Math.round(y+sy*k*.85),zz=Math.round(z+sz*k*.85);if(xx<0||xx>=sim.n||yy<0||yy>=sim.l||zz<0||zz>=sim.n)break;optical+=Math.pow(Math.max(0,sim.c[xx+sim.n*(zz+sim.n*yy)]-.012),.65);}this.lightData[x+sim.n*(z+sim.n*y)]=Math.round(255*Math.exp(-optical*.66));}
"""
s=s.replace(needle,insert+needle)
s=s.replace('  if(newSize){const error=gl.getError();', '  setup(4,this.lightTex,gl.TEXTURE_3D);if(newSize)gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,sim.n,sim.n,sim.l,0,gl.RED,gl.UNSIGNED_BYTE,this.lightData);else gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,sim.n,sim.n,sim.l,gl.RED,gl.UNSIGNED_BYTE,this.lightData);\n  if(newSize){const error=gl.getError();')
s=s.replace('g.uniform1i(u.noiseTex,3);g.drawArrays', 'g.uniform1i(u.noiseTex,3);g.uniform1i(u.lightTex,4);g.drawArrays')
p.write_text(s)
p=Path('evidence/app.js');s=p.read_text().replace('renderer.upload(sim);','renderer.upload(sim,settings.timeOfDay);');p.write_text(s)
