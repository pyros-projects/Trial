/* The renderer reads the numerical fields; small-scale noise only shapes their density. */
class WeatherRenderer {
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL2 is unavailable. Enable hardware acceleration or use a current browser with WebGL2 support.');this.gl=gl;
  const vs=`#version 300 es
  precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
  const fs=`#version 300 es
  precision highp float;precision highp sampler3D;
  in vec2 uv;out vec4 fragColor;
  uniform vec2 res,mapCenter;uniform vec3 gridSize;uniform vec3 eye,rightV,upV,forwardV;uniform sampler2D terrainTex;uniform sampler3D cloudTex,windTex,noiseTex,lightTex;
  uniform float simTime,exposure,timeOfDay,rainDensity,sliceY,sliceZ,flash,mapExtent;uniform int mode,view,cloudSteps;uniform vec3 strike;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){return texture(noiseTex,(p+.5)/32.).r;}
  float fbm(vec3 p){return .58*noise(p)+.28*noise(p*2.08)+.14*noise(p*4.17);}
  vec4 ground(vec2 p){return texture(terrainTex,(((p+16.)/32.)*(gridSize.xy-1.)+.5)/gridSize.xy);}
  float heightAt(vec2 p){return ground(p).r;}
  vec3 tc(vec3 p){return (vec3((p.x+16.)/32.,(p.z+16.)/32.,p.y/12.)*(gridSize-1.)+.5)/gridSize;}
  vec4 field(vec3 p){return texture(cloudTex,tc(p));}
  vec4 winds(vec3 p){return texture(windTex,tc(p));}
  vec3 palette(float t){t=clamp(t,0.,1.);vec3 a=vec3(.20,.32,.45),b=vec3(.43,.70,.67),c=vec3(.70,.80,.49),d=vec3(.92,.59,.35);return t<.38?mix(a,b,t/.38):t<.72?mix(b,c,(t-.38)/.34):mix(c,d,(t-.72)/.28);}
  float valueAt(vec3 p){vec4 f=field(p),w=winds(p);if(mode==1)return(f.b+35.)/70.;if(mode==2)return f.a/115.;if(mode==3)return f.r/2.4;if(mode==4)return f.g*(f.b<0.?2.3:7.)*3.888/40.;if(mode==5)return(w.a+12.)/24.;if(mode==6)return length(w.xy)/35.;if(mode==7)return(w.z+8.)/28.;if(mode==8){vec4 a=winds(p+vec3(.5,0,0)),b=winds(p-vec3(.5,0,0)),c=winds(p+vec3(0,0,.5)),d=winds(p-vec3(0,0,.5));return .5+((a.y-b.y)-(c.x-d.x))*.18;}if(mode==9)return heightAt(p.xz)/3.8;if(mode==10)return ground(p.xz).g;return f.r/2.4;}
  vec2 boxHit(vec3 ro,vec3 rd,vec3 lo,vec3 hi){vec3 inv=1./(rd+vec3(1e-7));vec3 a=(lo-ro)*inv,b=(hi-ro)*inv;vec3 tmin=min(a,b),tmax=max(a,b);return vec2(max(max(tmin.x,tmin.y),tmin.z),min(min(tmax.x,tmax.y),tmax.z));}
  vec3 sunDir;float daylight;
  vec3 sky(vec3 rd){float horizon=exp(-max(rd.y,0.)*4.5);vec3 col=mix(vec3(.105,.22,.29),vec3(.53,.62,.57),horizon);float s=max(0.,dot(rd,sunDir));col+=vec3(.58,.43,.22)*pow(s,28.)*.55;col+=vec3(1.,.88,.64)*smoothstep(.9991,.99965,s)*.9;col=mix(vec3(.021,.04,.065)+col*.13,col,daylight);if(daylight<.25){float stars=step(.9994,hash(floor(rd*950.)));col+=stars*vec3(.5,.65,.63)*(1.-daylight);}return col;}
  float density(vec3 p){float c=field(p).r;if(c<.012)return 0.;if(p.y<heightAt(p.xz)+.12)return 0.;vec3 drift=vec3(simTime*.00055,0,simTime*.00018);float detail=fbm(p*.85+drift)*.8+noise(p*3.4+drift)*.2;return max(0.,pow(max(0.,c-.012),.65)-(1.-detail)*.40)*1.9;}
  vec3 terrainColor(vec3 p,vec3 rd,float distanceT){vec4 g=ground(p.xz);float h=g.r;vec2 eps=vec2(.14,0);vec3 normal=normalize(vec3(heightAt(p.xz-eps)-heightAt(p.xz+eps),.28,heightAt(p.xz-eps.yx)-heightAt(p.xz+eps.yx)));float fine=fbm(vec3(p.x*3.,h*2.,p.z*3.));float large=fbm(p*.7);vec3 col;
   bool water=h<.055||abs(g.b-1.)<.1||g.b>3.9;
   if(water){float ripple=sin(p.x*5.+simTime*.025)*sin(p.z*6.+simTime*.018);vec3 sea=mix(vec3(.095,.20,.20),vec3(.16,.28,.27),ripple*.25+.5);if(mode==9||mode==10)sea=palette(valueAt(p));float fog=1.-exp(-distanceT*.023);return mix(sea,sky(rd),fog);}
   else {col=mix(vec3(.065,.19,.075),vec3(.23,.32,.13),large);col=mix(col,vec3(.40,.39,.27),smoothstep(1.0,2.8,h)*(.3+.7*(1.-normal.y)));col*=.76+fine*.52;if(g.b>1.8&&g.b<2.2)col*=vec3(.65,.86,.68);if(g.b>2.8&&g.b<3.2){vec2 blocks=step(.35,fract(p.xz*4.));col=mix(vec3(.24,.26,.22),vec3(.42,.42,.36),blocks.x*blocks.y*.5);}col=mix(col,vec3(.63,.61,.42),smoothstep(.2,.05,h)*.7);col*=1.-g.g*.17;
    if(mode==9||mode==10)col=palette(valueAt(p));float snow=smoothstep(1.,-5.,field(vec3(p.x,h+.5,p.z)).b)*smoothstep(.15,.65,normal.y);col=mix(col,vec3(.8,.85,.79),snow*.9);
   }
   float light=max(0.,dot(normal,sunDir));float shadow=exp(-field(p+sunDir*3.+vec3(0,1.5,0)).r*.48);col*=mix(.28,1.,daylight)*(.45+.7*light*shadow);float fog=1.-exp(-distanceT*.014);return mix(col,sky(rd),fog*.7);
  }
  float lineGlow(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;float f=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);return length(p-a-ab*f);}
  void main(){
   float angle=(timeOfDay-6.)/12.*3.14159265;sunDir=normalize(vec3(cos(angle)*.65,max(-.4,sin(angle)),.28));daylight=smoothstep(-.15,.25,sin(angle));float aspect=res.x/res.y;vec3 ro=eye,rd=normalize(forwardV+rightV*uv.x*aspect*.56+upV*uv.y*.56);
   if(view==1){ro=vec3(uv.x*aspect*mapExtent+mapCenter.x,40.,-uv.y*mapExtent+mapCenter.y);rd=vec3(0,-1,0);}
   if(view==2){vec3 p=vec3(uv.x*17.5,(uv.y+1.)*6.7,sliceZ);vec3 col=vec3(.07,.12,.10);if(abs(p.x)<16.&&p.y<12.){float val=valueAt(p);col=palette(val);if(mode==0){vec4 f=field(p);col=mix(vec3(.17,.27,.28),vec3(.77,.84,.71),1.-exp(-f.r));col+=vec3(.08,.2,.25)*clamp(f.g,0.,1.);}float contour=1.-smoothstep(.02,.05,abs(fract(val*10.)-.5));col=mix(col,vec3(.78,.90,.71),contour*.12);vec2 grid=abs(fract(vec2((p.x+16.)/4.,p.y/2.))-.5);col*=1.-.12*(step(.491,grid.x)+step(.491,grid.y));if(p.y<heightAt(p.xz))col=vec3(.10,.18,.105);}
    fragColor=vec4(pow(col*exposure,vec3(.92)),1);return;
   }
   vec3 col=sky(rd);float terrainT=1000.;if(rd.y<-.001){float seaT=-ro.y/rd.y;vec3 sp=ro+rd*seaT;if(seaT>0.&&(abs(sp.x)>16.||abs(sp.z)>16.)){float rip=sin(sp.x*5.+simTime*.025)*sin(sp.z*6.+simTime*.018);vec3 sea=mix(vec3(.095,.20,.20),vec3(.16,.28,.27),rip*.25+.5);float fog=1.-exp(-seaT*.023);col=mix(sea,sky(rd),fog);terrainT=seaT;}}vec2 tb=boxHit(ro,rd,vec3(-16.,-.3,-16.),vec3(16.,4.,16.));if(tb.y>max(tb.x,0.)){float t=max(0.,tb.x),prev=t;for(int i=0;i<112;i++){if(t>tb.y)break;vec3 p=ro+rd*t;float d=p.y-heightAt(p.xz);if(d<.015){float a=prev,b=t;for(int k=0;k<5;k++){float m=(a+b)*.5;vec3 mp=ro+rd*m;if(mp.y<heightAt(mp.xz))b=m;else a=m;}terrainT=(a+b)*.5;vec3 hp=ro+rd*terrainT;col=terrainColor(hp,rd,terrainT);break;}prev=t;t+=clamp(d*.43,.07,1.15);}}
   if(view==1&&abs(ro.x)<=16.&&abs(ro.z)<=16.&&terrainT<1000.){vec3 p=ro+rd*terrainT;vec3 pp=vec3(p.x,sliceY,p.z);if(mode>0){col=mix(col,palette(valueAt(pp)),.85);float isoline=1.-smoothstep(.015,.04,abs(fract(valueAt(pp)*10.)-.5));col+=isoline*.065;}else{float cc=0.,rain=0.;for(int y=0;y<12;y++){vec4 f=field(vec3(p.x,float(y)+.5,p.z));cc+=f.r;rain+=f.g;}col=mix(col,vec3(.78,.83,.73),1.-exp(-cc*.3));col=mix(col,vec3(.32,.56,.57),clamp(rain*.12,0.,.6));}vec2 grid=abs(fract((p.xz+16.)/4.)-.5);col*=1.-.14*(step(.493,grid.x)+step(.493,grid.y));fragColor=vec4(pow(col*exposure,vec3(.92)),1);return;}
   if(view==1){fragColor=vec4(col*.28,1);return;}
   vec2 cb=boxHit(ro,rd,vec3(-16.,.05,-16.),vec3(16.,12.,16.));float start=max(0.,cb.x),finish=min(cb.y,terrainT);float tr=1.;vec3 acc=vec3(0.);
   if(finish>start){float ds=(finish-start)/float(cloudSteps);float jitter=hash(vec3(gl_FragCoord.xy,0.));float t=start+ds*jitter;for(int i=0;i<112;i++){if(i>=cloudSteps||tr<.012)break;vec3 p=ro+rd*t;vec4 f=field(p);float den=density(p);float rain=f.g*rainDensity;
    if(den>.005){float lit=texture(lightTex,tc(p)).r;lit=clamp(lit*(.86+.28*noise(p*3.4)),.025,1.);vec3 cloudColor=mix(vec3(.095,.16,.18),vec3(1.13,1.11,.95),lit);cloudColor*=.38+.62*daylight;cloudColor+=vec3(.06,.10,.09)*smoothstep(2.,10.,p.y);if(mode>0&&mode<9)cloudColor=mix(cloudColor,palette(valueAt(p)),.78);cloudColor+=flash*vec3(.6,.74,.95)*exp(-length(p-strike)*.3);float a=1.-exp(-den*ds*1.65);acc+=tr*cloudColor*a;tr*=1.-a;}
    if(rain>.008&&p.y>heightAt(p.xz)){vec3 cell=vec3(p.x*11.,p.y*.75+simTime*.28,p.z*11.);float streak=pow(noise(cell),14.)*16.;float a=min(.15,rain*ds*(.025+streak*.25));vec3 rainCol=f.b<0.?vec3(.83,.89,.85):vec3(.48,.64,.65);acc+=tr*rainCol*a;tr*=1.-a;}
    if(mode>0&&mode<9&&abs(p.z-sliceZ)<ds*.65){float a=.35;acc+=tr*palette(valueAt(p))*a;tr*=1.-a;}
    t+=ds;
   }}
   col=col*tr+acc;col+=flash*vec3(.13,.17,.21);float vignette=1.-.13*dot(uv*.55,uv*.55);col=1.-exp(-max(col,vec3(0.))*exposure*1.42);col=pow(col,vec3(.83))*vignette;fragColor=vec4(col,1.);
  }`;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){let error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader compilation failed: '+error);}return s;};
  const vert=compile(gl.VERTEX_SHADER,vs),frag=compile(gl.FRAGMENT_SHADER,fs);this.program=gl.createProgram();gl.attachShader(this.program,vert);gl.attachShader(this.program,frag);gl.linkProgram(this.program);gl.deleteShader(vert);gl.deleteShader(frag);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('Shader link failed: '+gl.getProgramInfoLog(this.program));gl.useProgram(this.program);this.uniforms={};for(const name of ['res','gridSize','mapCenter','mapExtent','eye','rightV','upV','forwardV','terrainTex','cloudTex','windTex','noiseTex','lightTex','simTime','exposure','timeOfDay','rainDensity','sliceY','sliceZ','flash','mode','view','cloudSteps','strike'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
  this.terrainTex=gl.createTexture();this.cloudTex=gl.createTexture();this.windTex=gl.createTexture();this.lightTex=gl.createTexture();this.n=0;this.l=0;this.uploads=0;this.renders=0;const noiseData=new Uint8Array(32*32*32);let random=73591;for(let i=0;i<noiseData.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;noiseData[i]=random>>>24;}this.noiseTex=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_3D,this.noiseTex);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.REPEAT);gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,32,32,32,0,gl.RED,gl.UNSIGNED_BYTE,noiseData);
  gl.bindVertexArray(gl.createVertexArray());gl.disable(gl.DEPTH_TEST);
 }
 upload(sim,timeOfDay=15.5){const gl=this.gl,N=sim.n*sim.n*sim.l,newSize=this.n!==sim.n||this.l!==sim.l;if(newSize){this.cloudData=new Float32Array(N*4);this.windData=new Float32Array(N*4);this.lightData=new Uint8Array(N);this.groundData=new Float32Array(sim.n*sim.n*4);this.n=sim.n;this.l=sim.l;}
  for(let i=0;i<N;i++){const j=i*4;this.cloudData[j]=sim.c[i];this.cloudData[j+1]=sim.r[i];this.cloudData[j+2]=sim.t[i];this.cloudData[j+3]=100*sim.q[i]/Math.max(.01,sim.qSaturation?sim.qSaturation(sim.t[i]):(3.8*Math.exp(.065*sim.t[i])));this.windData[j]=sim.u[i];this.windData[j+1]=sim.v[i];this.windData[j+2]=sim.w[i];this.windData[j+3]=sim.p[i];}
  for(let i=0;i<sim.n*sim.n;i++){this.groundData[i*4]=sim.terrain[i];this.groundData[i*4+1]=sim.moisture[i];this.groundData[i*4+2]=sim.surface[i];this.groundData[i*4+3]=0;}
  // Six-point optical-depth approximation through actual cloud water, evaluated once per model update.
  // Precomputing this coarse shadow field avoids three additional density ray samples per pixel.
  const angle=(timeOfDay-6)/12*Math.PI,sun=[Math.cos(angle)*.65,Math.max(-.4,Math.sin(angle)),.28],length=Math.hypot(...sun),sx=sun[0]/length*(sim.n-1)/32,sz=sun[2]/length*(sim.n-1)/32,sy=sun[1]/length*(sim.l-1)/12;
  for(let y=0;y<sim.l;y++)for(let z=0;z<sim.n;z++)for(let x=0;x<sim.n;x++){let optical=0;for(let k=1;k<=6;k++){const xx=Math.round(x+sx*k*.85),yy=Math.round(y+sy*k*.85),zz=Math.round(z+sz*k*.85);if(xx<0||xx>=sim.n||yy<0||yy>=sim.l||zz<0||zz>=sim.n)break;optical+=Math.pow(Math.max(0,sim.c[xx+sim.n*(zz+sim.n*yy)]-.012),.65);}this.lightData[x+sim.n*(z+sim.n*y)]=Math.round(255*Math.exp(-optical*.66));}
  const setup=(unit,tex,target)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(target,tex);gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(target===gl.TEXTURE_3D)gl.texParameteri(target,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);};
  setup(0,this.terrainTex,gl.TEXTURE_2D);if(newSize)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,sim.n,sim.n,0,gl.RGBA,gl.FLOAT,this.groundData);else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,sim.n,sim.n,gl.RGBA,gl.FLOAT,this.groundData);
  for(const [unit,tex,data] of [[1,this.cloudTex,this.cloudData],[2,this.windTex,this.windData]]){setup(unit,tex,gl.TEXTURE_3D);if(newSize)gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA16F,sim.n,sim.n,sim.l,0,gl.RGBA,gl.FLOAT,data);else gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,sim.n,sim.n,sim.l,gl.RGBA,gl.FLOAT,data);}
  setup(4,this.lightTex,gl.TEXTURE_3D);if(newSize)gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,sim.n,sim.n,sim.l,0,gl.RED,gl.UNSIGNED_BYTE,this.lightData);else gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,sim.n,sim.n,sim.l,gl.RED,gl.UNSIGNED_BYTE,this.lightData);
  if(newSize){const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error('WebGL texture allocation failed (code '+error+'). Reduce grid or render quality.');}this.uploads++;
 }
 draw(options){const g=this.gl,u=this.uniforms;let w=Math.max(1,Math.round(this.canvas.clientWidth*options.scale)),h=Math.max(1,Math.round(this.canvas.clientHeight*options.scale));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}g.viewport(0,0,w,h);g.useProgram(this.program);g.uniform2f(u.res,w,h);g.uniform3f(u.gridSize,this.n,this.n,this.l);g.uniform2fv(u.mapCenter,options.mapCenter);g.uniform1f(u.mapExtent,options.mapExtent);for(const k of ['eye','rightV','upV','forwardV'])g.uniform3fv(u[k],options[k]);for(const k of ['simTime','exposure','timeOfDay','rainDensity','sliceY','sliceZ','flash'])g.uniform1f(u[k],options[k]);for(const k of ['mode','view','cloudSteps'])g.uniform1i(u[k],options[k]);g.uniform3fv(u.strike,options.strike);g.uniform1i(u.terrainTex,0);g.uniform1i(u.cloudTex,1);g.uniform1i(u.windTex,2);g.uniform1i(u.noiseTex,3);g.uniform1i(u.lightTex,4);g.drawArrays(g.TRIANGLES,0,3);this.renders++;
 }
}
