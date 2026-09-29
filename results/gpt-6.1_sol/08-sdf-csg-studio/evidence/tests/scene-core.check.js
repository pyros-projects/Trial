
'use strict';
var SceneCore = (() => {
  const TYPES=['sphere','box','roundedBox','cylinder','capsule','torus','plane','deformed'];
  const OPS=['union','subtract','intersect','smoothUnion','smoothSubtract'];
  const MATERIALS=['diffuse','metallic','glossy','emissive','glass'];
  const PATTERNS=['solid','checker','stripes','marble'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  function makeObject(type='sphere',id=1) {
    const sizes={sphere:[1,1,1],box:[.7,.7,.7],roundedBox:[.7,.7,.7],cylinder:[.65,.85,1],capsule:[.38,.65,1],torus:[1,.28,1],plane:[1,1,1],deformed:[1,1,1]};
    return {id,name:({roundedBox:'Rounded box',deformed:'Wave sphere'}[type]||type[0].toUpperCase()+type.slice(1)),type,operation:'union',visible:true,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],size:(sizes[type]||sizes.sphere).slice(),rounding:type==='roundedBox'?.14:0,smoothness:.35,deformation:.14,frequency:3,repeat:0,spacing:2.6,animation:'none',material:{kind:'diffuse',color:'#cb785b',roughness:.28,pattern:'solid',emission:2,ior:1.45,opacity:.28}};
  }
  function makeScene(objects=[]) {
    return {app:'FIELD',version:1,title:'Untitled study',objects:clone(objects),selected:objects[0]?.id||null,camera:{target:[0,0,0],azimuth:.55,elevation:.22,distance:7.8},settings:{resolution:.75,steps:128,epsilon:.002,maxDistance:60,shadows:24,ao:4,reflections:1,exposure:1.15,fov:42,background:'warm',grid:true,mode:0,sliceAxis:'y',slicePosition:0,sliceRange:5},animation:{time:0,playing:false,speed:1}};
  }
  function validate(source) {
    if(!source||source.app!=='FIELD'||source.version!==1) throw Error('Use a FIELD scene JSON document, version 1.');
    if(!Array.isArray(source.objects)||source.objects.length>32)throw Error('A scene can contain up to 32 objects.');
    const s=clone(source), ids=new Set();
    const number=(n,min,max,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(label+' must be between '+min+' and '+max+'.');};
    const vec=(a,min,max,label)=>{if(!Array.isArray(a)||a.length!==3)throw Error(label+' needs three numbers.');a.forEach(n=>number(n,min,max,label));};
    if(typeof s.title!=='string'||s.title.length>100)throw Error('Scene title must be at most 100 characters.');
    for(const o of s.objects){
      number(o.id,1,1000000,'Object ID');if(!Number.isInteger(o.id)||ids.has(o.id))throw Error('Every object needs a unique integer ID.');ids.add(o.id);
      if(typeof o.name!=='string'||o.name.length>80)throw Error('Object name must be at most 80 characters.');
      if(!TYPES.includes(o.type))throw Error('Unknown primitive: '+o.type);
      if(!OPS.includes(o.operation))throw Error('Unknown composition operation.');
      if(typeof o.visible!=='boolean')throw Error('Visibility must be true or false.');
      vec(o.position,-100,100,'Position');vec(o.rotation,-36000,36000,'Rotation');vec(o.scale,.02,20,'Scale');vec(o.size,.02,20,'Size');
      number(o.rounding,0,2,'Rounding');number(o.smoothness,.005,4,'Blend radius');number(o.deformation,0,.6,'Deformation');number(o.frequency,.1,12,'Frequency');number(o.repeat,0,4,'Repeat');if(!Number.isInteger(o.repeat))throw Error('Repeat count must be an integer.');number(o.spacing,.2,10,'Repeat spacing');
      if(!['none','spin','float','pulse'].includes(o.animation))throw Error('Unknown animation.');
      const m=o.material;if(!m||!MATERIALS.includes(m.kind))throw Error('Unknown material.');
      if(typeof m.color!=='string'||!/^#[0-9a-f]{6}$/i.test(m.color))throw Error('Material color must be a six-digit hex color.');
      if(!PATTERNS.includes(m.pattern))throw Error('Unknown material pattern.');
      number(m.roughness,.02,1,'Roughness');number(m.emission,0,8,'Emission');number(m.ior,1,2.5,'Refraction index');number(m.opacity,0,1,'Opacity');
    }
    if(!s.camera||!s.settings||!s.animation)throw Error('Scene requires camera, settings and animation.');
    vec(s.camera.target,-100,100,'Camera target');number(s.camera.azimuth,-1000,1000,'Camera azimuth');number(s.camera.elevation,-1.5,1.5,'Camera elevation');number(s.camera.distance,.5,100,'Camera distance');
    const ranges={resolution:[.25,2],steps:[16,256],epsilon:[.0001,.05],maxDistance:[5,150],shadows:[0,64],ao:[0,6],reflections:[0,2],exposure:[.1,4],fov:[20,90],mode:[0,7],slicePosition:[-20,20],sliceRange:[1,20]};
    for(const [k,r]of Object.entries(ranges))number(s.settings[k],r[0],r[1],k);
    for(const k of ['steps','shadows','ao','reflections','mode'])if(!Number.isInteger(s.settings[k]))throw Error(k+' must be an integer.');
    if(!['warm','slate','night'].includes(s.settings.background))throw Error('Unknown background.');
    if(typeof s.settings.grid!=='boolean'||!['x','y','z'].includes(s.settings.sliceAxis))throw Error('Invalid inspection settings.');
    number(s.animation.time,0,100000,'Animation time');number(s.animation.speed,.1,3,'Animation speed');if(typeof s.animation.playing!=='boolean')throw Error('Invalid playback state.');
    s.selected=ids.has(s.selected)?s.selected:(s.objects[0]?.id||null);
    return s;
  }
  function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object'){const y={};Object.keys(x).sort().forEach(k=>y[k]=stable(x[k]));return y;}return x;}
  function serialize(s){return JSON.stringify(stable(validate(s)),null,2);}
  function parse(text){if(typeof text!=='string'||text.length>500000)throw Error('Scene JSON must be under 500 KB.');let s;try{s=JSON.parse(text);}catch(e){throw Error('Invalid JSON: '+e.message);}return validate(s);}
  function inverseQuaternion(deg){const [x,y,z]=deg.map(v=>v*Math.PI/360),sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);return [-(sx*cy*cz-cx*sy*sz),-(cx*sy*cz+sx*cy*sz),-(cx*cy*sz-sx*sy*cz),cx*cy*cz+sx*sy*sz];}
  function srgbToLinear(hex){return hex.match(/[0-9a-f]{2}/gi).map(h=>{const c=parseInt(h,16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});}
  return {TYPES,OPS,MATERIALS,PATTERNS,makeObject,makeScene,parse,validate,serialize,clone,srgbToLinear,inverseQuaternion};
})();
