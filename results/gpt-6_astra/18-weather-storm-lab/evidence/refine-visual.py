from pathlib import Path
p=Path('evidence/render.js');s=p.read_text()
s=s.replace("float horizon=pow(1.-max(rd.y,0.),3.);vec3 col=mix(vec3(.20,.32,.37),vec3(.61,.67,.60),horizon);","float horizon=exp(-max(rd.y,0.)*4.5);vec3 col=mix(vec3(.105,.22,.29),vec3(.53,.62,.57),horizon);")
s=s.replace("float density(vec3 p){if(p.y<heightAt(p.xz)+.12)return 0.;float c=field(p).r;float detail=fbm(p*1.12+vec3(simTime*.00055,0,simTime*.00018));return max(0.,c*.72-.016)*smoothstep(.19,.83,detail)*2.0;}","float density(vec3 p){float c=field(p).r;if(c<.012)return 0.;if(p.y<heightAt(p.xz)+.12)return 0.;float detail=fbm(p*1.35+vec3(simTime*.00055,0,simTime*.00018));return pow(max(0.,c-.012),.7)*smoothstep(.14,.76,detail)*1.65;}")
s=s.replace("vec3 col=sky(rd);float terrainT=1000.;", "vec3 col=sky(rd);float terrainT=1000.;if(rd.y<-.001){float seaT=-ro.y/rd.y;vec3 sp=ro+rd*seaT;if(seaT>0.&&(abs(sp.x)>16.||abs(sp.z)>16.)){float rip=sin(sp.x*5.+simTime*.025)*sin(sp.z*6.+simTime*.018);vec3 sea=mix(vec3(.095,.20,.20),vec3(.16,.28,.27),rip*.25+.5);float fog=1.-exp(-seaT*.023);col=mix(sea,sky(rd),fog);terrainT=seaT;}}")
p.write_text(s)
p=Path('evidence/app.js');s=p.read_text().replace("yaw:.70,pitch:.43,distance:39,target:[0,3.0,0]","yaw:.58,pitch:.18,distance:27,target:[0,3.7,0]").replace("['Observatory',.70,.43,39,[0,3,0]]","['Observatory',.58,.18,27,[0,3.7,0]]")
p.write_text(s)
