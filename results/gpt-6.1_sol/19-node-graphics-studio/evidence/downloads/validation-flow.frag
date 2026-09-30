// Fieldwork: Validation flow
// Baked at frame 86, time 2.8907 s
#version 300 es
precision highp float;
const float u_time=2.89065934,u_frame=86.00000000,u_seed=18.00000000,u_view=0.0,u_space=1.0,u_aa=1.00000000,u_eval=0.0,u_dirty=0.0;
const vec2 u_resolution=vec2(1024.00000000,1024.00000000);
const float u_4_scale=1.00000000;
const float u_4_angle=-0.50000000;
const float u_4_x=0.00000000;
const float u_4_y=0.00000000;
const float u_5_scale=4.00000000;
const float u_5_octaves=5.00000000;
const float u_5_roughness=0.52000000;
const float u_5_lacunarity=2.00000000;
const float u_5_seed=8.00000000;
const float u_100_value=0.51687912;
const float u_6_distortion=0.50000000;
const float u_6_amount=0.62000000;
const float u_2_speed=1.00000000;
const float u_2_offset=0.00000000;
const float u_3_a=1.00000000;
const float u_3_b=0.55000000;
const float u_7_frequency=4.80000000;
const float u_7_angle=0.30000000;
const float u_7_phase=0.00000000;
const float u_7_sharpness=2.20000000;
const float u_8_value=0.17000000;
const vec4 u_8_color0=vec4(0.00600000,0.02600000,0.03800000,1.00000000);
const vec4 u_8_color1=vec4(0.01000000,0.23000000,0.23000000,1.00000000);
const vec4 u_8_color2=vec4(0.48000000,0.93000000,0.74000000,1.00000000);
const vec4 u_8_color3=vec4(1.00000000,0.45000000,0.25000000,1.00000000);
const float u_8_stop1=0.57000000;
const float u_8_stop2=0.85000000;
const float u_8_offset=0.00000000;
const float u_9_angle=0.00000000;
const float u_9_scale=0.70000000;
const float u_9_offset=0.00000000;
const float u_10_value=0.50000000;
const float u_10_inMin=0.00000000;
const float u_10_inMax=1.00000000;
const float u_10_outMin=1.00000000;
const float u_10_outMax=0.15000000;
const vec4 u_11_base=vec4(0.03000000,0.06000000,0.09000000,1.00000000);
const vec4 u_11_layer=vec4(0.85000000,0.49000000,0.22000000,1.00000000);
const float u_11_mask=0.50000000;
const vec4 u_12_color=vec4(0.50000000,0.50000000,0.50000000,1.00000000);
const float u_12_exposure=0.00000000;
const float u_12_contrast=1.10000000;
const float u_12_saturation=1.00000000;
const vec4 u_13_color=vec4(0.08000000,0.11000000,0.12000000,1.00000000);
const float u_13_opacity=1.00000000;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}vec2 hash22(vec2 p){return vec2(hash21(p),hash21(p+vec2(37.8,91.2)));}float noise2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),u.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),u.x),u.y);}
// UV Coordinates #1
#line 1100
vec2 n1(vec2 p){return p;}
// Transform UV #4
#line 1400
vec2 n4(vec2 p){vec2 q=(n1(p)-.5)*max(.01,abs(u_4_scale));float r=u_4_angle;return mat2(cos(r),-sin(r),sin(r),cos(r))*q+.5+vec2(u_4_x,u_4_y);}
// Fractal Noise #5
#line 1500
float n5(vec2 p){vec2 q=n4(p)*u_5_scale+u_5_seed+u_seed;float s=0.0,w=0.0,amp=.5;for(int i=0;i<6;i++){if(float(i)>=u_5_octaves)break;s+=noise2(q)*amp;w+=amp;q=q*u_5_lacunarity+vec2(7.1,3.8);amp*=u_5_roughness;}return s/max(w,.001);}
// Constant #100
#line 11000
float n100(vec2 p){return u_100_value;}
// Domain Warp #6
#line 1600
vec2 n6(vec2 p){vec2 d=vec2(n5(p),n5(p+vec2(4.71,8.32)))-.5;return n4(p)+d*n100(p);}
// Time #2
#line 1200
float n2(vec2 p){return u_time*u_2_speed+u_2_offset;}
// Multiply #3
#line 1300
float n3(vec2 p){return n2(p)*u_3_b;}
// Wave Bands #7
#line 1700
float n7(vec2 p){float v=sin(dot(n6(p),vec2(cos(u_7_angle),sin(u_7_angle)))*u_7_frequency*6.2831853+n3(p))*.5+.5;return pow(v,u_7_sharpness);}
// Color Ramp #8
#line 1800
vec4 n8(vec2 p){float v=clamp(n7(p)+u_8_offset,0.0,1.0);float s1=clamp(u_8_stop1,.01,.97),s2=max(s1+.01,u_8_stop2);float t= v<s1?v/s1:(v<s2?(v-s1)/(s2-s1):(v-s2)/max(.001,1.0-s2));t=clamp(t,0.0,1.0);t=t*t*(3.0-2.0*t);return v<s1?mix(u_8_color0,u_8_color1,t):(v<s2?mix(u_8_color1,u_8_color2,t):mix(u_8_color2,u_8_color3,t));}
// Gradient #9
#line 1900
float n9(vec2 p){vec2 q=n1(p);return length(q-.5)*2.0*u_9_scale+u_9_offset;}
// Remap #10
#line 2000
float n10(vec2 p){return mix(u_10_outMin,u_10_outMax,(n9(p)-u_10_inMin)/max(0.0001,u_10_inMax-u_10_inMin));}
// Blend #11
#line 2100
vec4 n11(vec2 p){vec4 b=n8(p),c=vec4(vec3(n10(p)),1.0);float m=clamp(u_11_mask,0.0,1.0);return vec4(mix(b.rgb,b.rgb*c.rgb,m),b.a);}
// Color Adjust #12
#line 2200
vec4 n12(vec2 p){vec4 c=n11(p);c.rgb=(c.rgb-.5)*u_12_contrast+.5;c.rgb=mix(vec3(dot(c.rgb,vec3(.2126,.7152,.0722))),c.rgb,u_12_saturation)*exp2(u_12_exposure);return c;}
// Material Output #13
#line 2300
vec4 n13(vec2 p){vec4 c=n12(p);return vec4(c.rgb,c.a*u_13_opacity);}
#line 1
out vec4 fragColor;
vec4 material(vec2 p){return n13(p);}
void main(){vec2 p=vec2(gl_FragCoord.x/u_resolution.x,1.0-gl_FragCoord.y/u_resolution.y);vec4 c=material(p);if(u_aa>1.5){vec2 d=0.25/u_resolution;c=(material(p+d)+material(p-d)+material(p+vec2(d.x,-d.y))+material(p+vec2(-d.x,d.y)))*.25;}bool invalid=any(isnan(c))||any(isinf(c));if(u_view<.5){if(invalid)c=vec4(1.,0.,1.,1.);if(u_space>.5)c.rgb=pow(max(c.rgb,0.0),vec3(1.0/2.2));}else if(u_view<4.5){float v=u_view<1.5?c.r:(u_view<2.5?c.g:(u_view<3.5?c.b:c.a));c=vec4(vec3(v),1.);}else if(u_view<5.5)c=vec4(vec3(dot(c.rgb,vec3(.2126,.7152,.0722))),1.);else if(u_view<6.5){float h=dot(c.rgb,vec3(.2126,.7152,.0722));vec2 d=1.0/u_resolution;float dx=dot(material(p+vec2(d.x,0.)).rgb,vec3(.2126,.7152,.0722))-h;float dy=dot(material(p+vec2(0.,d.y)).rgb,vec3(.2126,.7152,.0722))-h;c=vec4(normalize(vec3(-dx*40.,-dy*40.,1.))*.5+.5,1.);}else if(u_view<7.5)c=vec4(vec3(.27,.82,.67)*dot(c.rgb,vec3(.333)),1.);else if(u_view<8.5){float v=dot(c.rgb,vec3(.333));c=vec4(v<0.?vec3(.2,.4,1.):(v>1.?vec3(1.,.35,.08):vec3(v*.4,v,.35)),1.);}else if(u_view<9.5)c=invalid?vec4(1.,0.,.8,1.):vec4(vec3(.06)+c.rgb*.15,1.);else if(u_view<10.5)c=vec4(mix(vec3(.08,.35,.24),vec3(1.,.3,.1),clamp(u_eval/33.,0.,1.))*(.5+.5*step(p.x,clamp(u_eval/33.,0.,1.))),1.);else if(u_view<11.5)c=vec4(mix(vec3(.08,.45,.38),vec3(.8,.36,.13),u_dirty),1.);else {float grid=max(step(.9,fract(p.x*u_resolution.x/16.)),step(.9,fract(p.y*u_resolution.y/16.)));c=vec4(mix(c.rgb,vec3(.7,1.,.7),grid*.5),1.);}fragColor=c;}