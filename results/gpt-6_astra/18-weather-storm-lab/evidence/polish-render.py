from pathlib import Path
p=Path('evidence/render.js');s=p.read_text()
s=s.replace("float detail=fbm(p*1.35+vec3(simTime*.00055,0,simTime*.00018));return pow(max(0.,c-.012),.7)*smoothstep(.14,.76,detail)*1.65;","vec3 drift=vec3(simTime*.00055,0,simTime*.00018);float detail=fbm(p*.85+drift)*.8+noise(p*3.4+drift)*.2;return max(0.,pow(max(0.,c-.012),.65)-(1.-detail)*.40)*1.9;")
s=s.replace("float lit=exp(-density(p+sunDir*.9)*1.3-density(p+sunDir*2.)*.8);vec3 cloudColor=mix(vec3(.22,.29,.30),vec3(.96,.96,.86),lit*.82);","float lit=exp(-density(p+sunDir*.8)*2.0-density(p+sunDir*1.8)*1.8-density(p+sunDir*3.8)*1.2);vec3 cloudColor=mix(vec3(.095,.16,.18),vec3(1.13,1.11,.95),lit);")
s=s.replace("cloudColor+=vec3(.16,.23,.20)*smoothstep(2.,10.,p.y);","cloudColor+=vec3(.06,.10,.09)*smoothstep(2.,10.,p.y);")
s=s.replace("col=mix(vec3(.12,.22,.12),vec3(.28,.34,.19),large)","col=mix(vec3(.065,.19,.075),vec3(.23,.32,.13),large)")
# Match open ocean with the bounded field tile, avoiding a square sea-color seam.
s=s.replace("if(water){float ripple=", "if(water){float ripple=")
a=s.index("if(water){float ripple=");b=s.index("\n   else {col=",a)
s=s[:a]+"if(water){float ripple=sin(p.x*5.+simTime*.025)*sin(p.z*6.+simTime*.018);vec3 sea=mix(vec3(.095,.20,.20),vec3(.16,.28,.27),ripple*.25+.5);if(mode==9||mode==10)sea=palette(valueAt(p));float fog=1.-exp(-distanceT*.023);return mix(sea,sky(rd),fog);}"+s[b:]
p.write_text(s)
