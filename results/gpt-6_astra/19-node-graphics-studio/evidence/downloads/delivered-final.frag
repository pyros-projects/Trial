// Form Lab fragment shader. WebGL 2. Uniform values and timeline:
// {"version":1,"name":"Chromatic currents","nodes":[{"id":1,"type":"uv","x":30,"y":70,"p":{"scale":1},"keys":{}},{"id":2,"type":"time","x":30,"y":244,"p":{"speed":0.22,"offset":0},"keys":{}},{"id":3,"type":"fbm","x":220,"y":70,"p":{"scale":2.8,"octaves":5,"roughness":0.56},"keys":{}},{"id":4,"type":"warp","x":220,"y":244,"p":{"strength":1.4},"keys":{}},{"id":5,"type":"fbm","x":410,"y":70,"p":{"scale":2.8,"octaves":4,"roughness":0.46},"keys":{}},{"id":6,"type":"sine","x":410,"y":244,"p":{"frequency":2.8,"phase":0},"keys":{}},{"id":7,"type":"ramp","x":30,"y":428,"p":{"shadow":"#102b35","low":"#284c65","mid":"#9479b4","high":"#e7b7ac","light":"#e6e7c1","contrast":1.25,"offset":0},"keys":{}},{"id":8,"type":"light","x":220,"y":428,"p":{"strength":0.8,"angle":125,"ambient":0.8},"keys":{}},{"id":9,"type":"output","x":410,"y":428,"p":{"exposure":1,"alpha":1},"keys":{}}],"edges":[{"from":1,"to":3,"port":0},{"from":2,"to":3,"port":1},{"from":1,"to":4,"port":0},{"from":3,"to":4,"port":1},{"from":4,"to":5,"port":0},{"from":2,"to":5,"port":1},{"from":5,"to":6,"port":0},{"from":2,"to":6,"port":1},{"from":6,"to":7,"port":0},{"from":7,"to":8,"port":0},{"from":5,"to":8,"port":1},{"from":8,"to":9,"port":0}],"frames":[{"x":13,"y":51,"w":566,"h":347,"label":"01  /  GENERATIVE FIELD"},{"x":13,"y":409,"w":566,"h":165,"label":"02  /  COLOR & SURFACE"}],"timeline":{"duration":8,"fps":30,"time":6.666200000000481,"loop":true,"interpolation":"smooth"},"settings":{"resolution":512,"seed":7,"aa":1,"colorSpace":0,"quality":1,"cache":true,"grid":true,"snap":false,"theme":"dark","limit":30,"diagnostic":0}}
#version 300 es
precision highp float;
uniform float u_time,u_frame,u_seed;
uniform vec2 u_resolution;
uniform int u_root,u_diag,u_aa,u_tile,u_srgb;
out vec4 frag;
vec4 S(float v){return vec4(v,v,v,1.);}
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hash22(vec2 p){return vec2(hash21(p),hash21(p+17.7));}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
uniform float n1_scale;
// NODE 1: UV coordinates
vec4 f1(vec2 p){return vec4(p*n1_scale,0.,1.);}
uniform float n2_speed;
uniform float n2_offset;
// NODE 2: Time
vec4 f2(vec2 p){return S(u_time*n2_speed+n2_offset);}
uniform float n3_scale;
uniform float n3_octaves;
uniform float n3_roughness;
// NODE 3: Fractal noise
vec4 f3(vec2 p){vec2 q=f1(p).xy*n3_scale+u_seed;float t=f2(p).r;float f=0.,a=.5,s=0.;for(int i=0;i<7;i++){if(float(i)>=n3_octaves)break;f+=a*noise(q+vec2(t*.2,-t*.15));s+=a;q=mat2(.8,-.6,.6,.8)*q*2.03+7.1;a*=n3_roughness;}return S(f/max(s,.001));}
uniform float n4_strength;
// NODE 4: Domain warp
vec4 f4(vec2 p){vec2 q=f1(p).xy;float a=f3(p).r;float b=f3(p+vec2(.37,.19)).r;return vec4(q+(vec2(a,b)-.5)*n4_strength,0.,1.);}
uniform float n5_scale;
uniform float n5_octaves;
uniform float n5_roughness;
// NODE 5: Fractal noise
vec4 f5(vec2 p){vec2 q=f4(p).xy*n5_scale+u_seed;float t=f2(p).r;float f=0.,a=.5,s=0.;for(int i=0;i<7;i++){if(float(i)>=n5_octaves)break;f+=a*noise(q+vec2(t*.2,-t*.15));s+=a;q=mat2(.8,-.6,.6,.8)*q*2.03+7.1;a*=n5_roughness;}return S(f/max(s,.001));}
uniform float n6_frequency;
uniform float n6_phase;
// NODE 6: Sine wave
vec4 f6(vec2 p){return S(.5+.5*sin(f5(p).r*n6_frequency*6.283185+f2(p).r));}
uniform vec3 n7_shadow;
uniform vec3 n7_low;
uniform vec3 n7_mid;
uniform vec3 n7_high;
uniform vec3 n7_light;
uniform float n7_contrast;
uniform float n7_offset;
// NODE 7: Color ramp
vec4 f7(vec2 p){float t=clamp((f6(p).r-.5)*n7_contrast+.5+n7_offset,0.,1.);vec3 c=mix(n7_shadow,n7_low,smoothstep(0.,.25,t));c=mix(c,n7_mid,smoothstep(.25,.5,t));c=mix(c,n7_high,smoothstep(.5,.75,t));c=mix(c,n7_light,smoothstep(.75,1.,t));return vec4(c,1.);}
uniform float n8_strength;
uniform float n8_angle;
uniform float n8_ambient;
// NODE 8: Surface lighting
vec4 f8(vec2 p){float h=f5(p).r;float x=f5(p+vec2(.002,0.)).r-h,y=f5(p+vec2(0.,.002)).r-h;vec3 N=normalize(vec3(-x*n8_strength,-y*n8_strength,.01));float a=radians(n8_angle);vec3 L=normalize(vec3(cos(a),sin(a),.7));float l=n8_ambient+(1.-n8_ambient)*max(0.,dot(N,L));vec4 c=f7(p);return vec4(c.rgb*l+pow(max(0.,dot(reflect(-L,N),vec3(0.,0.,1.))),24.)*.16,c.a);}
uniform float n9_exposure;
uniform float n9_alpha;
// NODE 9: Output
vec4 f9(vec2 p){vec4 c=f8(p);return vec4(c.rgb*n9_exposure,c.a*n9_alpha);}
vec4 sampleGraph(vec2 p){return f9(p);}
void main(){vec2 p=gl_FragCoord.xy/u_resolution; p.y=1.-p.y;if(u_tile==1)p=fract(p*3.);vec4 c=vec4(0.);int samples=u_aa==1?4:1;for(int i=0;i<samples;i++){vec2 d=samples==1?vec2(0.):vec2((i==0||i==2)?.35:-.35,i<2?.35:-.35)/u_resolution;c+=sampleGraph(p+d);}c/=float(samples);float l=dot(c.rgb,vec3(.2126,.7152,.0722));if(u_diag>=1&&u_diag<=4)c=vec4(vec3(c[u_diag-1]),1.);if(u_diag==5)c=vec4(vec3(l),1.);if(u_diag==6){float x=dFdx(l),y=-dFdy(l);c=vec4(normalize(vec3(-x,-y,.01))*.5+.5,1.);}if(u_diag==7)c=vec4(fract(vec3(.137,.413,.731)*float(u_root))*(.35+.65*clamp(l,0.,1.)),1.);if(u_diag==8)c=vec4(l<0.?vec3(.1,.4,1.):(l>1.?vec3(1.,.2,.1):vec3(0.,l,.2)),1.);if(u_diag==9)c=vec4(any(isnan(c))||any(isinf(c))?vec3(1.,0.,.7):vec3(.035,.07,.045),1.);if(u_srgb==1&&u_diag==0)c.rgb=pow(max(c.rgb,vec3(0.)),vec3(1./2.2));frag=clamp(c,0.,1.);}