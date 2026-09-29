# Independent, hand-derived center-ray intersections for imported fixtures.
# Camera (0,0,6); unit sphere scaled (1,2,.5) has front z=.5.
# Box and rounded box extend .7*.5 and (.7+.14)*.5 along z.
import json
checks={'sphere':(5.5,17),'box':(5.65,17),'roundedBox':(5.58,17),'cylinder':(5.675,17),'capsule':(5.81,17),'torus':(5.36,17),'deformed':(5.5,17),'plane':(6,17),'rotation':(5,17),'union':(4.6,12),'subtract':(6.2,12),'intersect':(4.8,11),'smoothUnion':(4.58392857,12),'smoothSubtract':(6.2,12)}
passed=0
for name,(distance,owner) in checks.items():
 p=json.load(open('evidence/logs/analytic-'+name+'.json'))
 ok=p['objectId']==owner and abs(p['distance']-distance)<.01
 print(('PASS' if ok else 'FAIL'),name,'expected',distance,owner,'actual',p['distance'],p['objectId'],'steps',p['steps'])
 passed+=ok
print(f'{passed}/{len(checks)} GPU field checks passed')
assert passed==len(checks)
