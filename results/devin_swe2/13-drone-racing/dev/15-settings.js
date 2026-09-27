// ================= settings =================
const DEFAULTS={
 seed:7,preset:'canyon',difficulty:'normal',raceMode:'time',laps:2,
 flightMode:'angle',gravity:9.81,twr:2.8,dragK:1.0,ratesDps:700,expo:0.35,levelGain:9,
 altHold:false,antiCrash:true,forgive:0.5,
 fov:95,camTilt:16,quality:'medium',resScale:1,shadowQ:'low',partDens:1,
 volume:0.5,muted:false,ghost:true,tele:false,diag:false,
 deadzone:0.08,invR:false,invP:false,invY:false,invT:false,
};
const S=Object.assign({},DEFAULTS);
try{const sv=JSON.parse(localStorage.getItem('v1.settings')||'null');
 if(sv&&typeof sv==='object')for(const k in DEFAULTS)if(k in sv&&typeof sv[k]===typeof DEFAULTS[k])S[k]=sv[k]}catch(e){}
function saveSettings(){try{localStorage.setItem('v1.settings',JSON.stringify(S))}catch(e){}}
