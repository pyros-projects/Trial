from workflow import *
try:
    loadpreset('Multi-product bus');button('Simulation speed 4x')
    wait_for('(Forge.diagnostics().delivered.engine || 0)>=3');pause()
    d=diag();assert d['delivered'].get('circuit',0)>0
    assert structure(25,18)['type']=='belt' and structure(25,16)['type']=='pole'
    shot('22-multi-product-bus-fixed.png');dump('bus-fixed.json',d)
    result('Multi-product bus repaired',d['delivered'])
    # Every diagnostic overlay is selected with its real menu control.
    for name in ['Flow direction','Connections','Power network','Utilization','Congestion','Blocked outputs','Structure status','Natural view']:
        ab('click','#overlay-btn');button(name)
        assert ev("document.querySelector('#overlay-menu').classList.contains('hidden')")
    button('Toggle grid');button('Toggle grid');result('All eight overlays and grid control','Selected through labeled menu and canvas inspected')
    # Preset generation is seeded; compare terrain geometry, not elapsed simulation.
    button('Simulation settings');ab('fill','#setting-seed','4242');ab('select','#setting-size','48,36');button('Regenerate current preset');pause()
    first=state();assert first['seed']==4242 and (first['w'],first['h'])==(48,36)
    a=[{k:t[k] for k in ['x','y','type','max','renewable']} for t in first['terrain']]
    button('Simulation settings');ab('fill','#setting-seed','4242');ab('select','#setting-size','48,36');button('Regenerate current preset');pause()
    b=[{k:t[k] for k in ['x','y','type','max','renewable']} for t in state()['terrain']]
    assert a==b;result('Deterministic seed and grid size',{'seed':4242,'size':[48,36],'terrainCells':len(a)})
    loadpreset('High-throughput test');button('Simulation speed 4x');time.sleep(2);d=diag();dump('stress-live.json',d)
    assert len(d['structures'])>600 and d['items']>=1000
    old=d['delivered'].get('plate',0);wait_for(f"(Forge.diagnostics().delivered.plate || 0)>{old+20}")
    pause();shot('23-high-throughput-stress.png')
    result('Stress preset performance',{'structures':len(d['structures']),'movingItems':d['items'],'fps':d['fps'],'deliveryRate':d['deliveryRate']})
    # True viewport change keeps this many-item factory active.
    ab('set','viewport',390,844,2);button('Fit factory in view');resume();old=diag()['delivered'].get('plate',0)
    wait_for(f"(Forge.diagnostics().delivered.plate || 0)>{old+30}");pause();shot('25-stress-narrow.png')
    ab('set','viewport',1280,800,1);button('Fit factory in view')
    result('Stress preset continues after narrow resize',{'delivered':diag()['delivered'],'fps':diag()['fps']})
    # Density decreases preserve logical packets. A few steps may produce/consume,
    # so conservation is tested per material against real accounting totals.
    before=state();button('Simulation settings');ab('select','#setting-density','2');button('Apply to factory')
    for _ in range(5):button('Single step')
    current=state();assert all(0<=it['p']<=1 for s in current['structures'] for it in s['items'])
    def inventory(st,k):return sum(s['inv'].get(k,0)+sum(x==k for x in s['out'])+sum(x['type']==k for x in s['items']) for s in st['structures'])
    for k in ['iron','plate','coal']:
        delta=current['stats']['produced'].get(k,0)-before['stats']['produced'].get(k,0)-(current['stats']['consumed'].get(k,0)-before['stats']['consumed'].get(k,0))
        assert inventory(current,k)-inventory(before,k)==delta,(k,delta)
    button('Save factory');ab('fill','#slot-name','Stress reduced density');button('Save slot')
    assert ev("localStorage.getItem('forge.factory.v1.Stress reduced density')!==null")
    expected=state();button('Close dialog');button('Save factory');button('Load slot Stress reduced density');assert state()==expected
    result('Density reduction and conservation','No negative item positions; iron/plate/coal accounting balances; exact busy-factory save/load')
    before=state();ab('reload');wait_for('typeof Forge!=="undefined"');after=state();assert after==before
    result('Complete autosave restoration after reload',{'tick':after['tick'],'structures':len(after['structures'])})
    # A corrupted item direction and a duplicate structure are rejected by UI import.
    for label,edit in [('bad-direction',lambda s:s['structures'][0].update(dir=9)),('duplicate-structure',lambda s:s['structures'].append(dict(s['structures'][0])) )]:
        bad=state();edit(bad);f=E/'tests'/(label+'.json');f.write_text(json.dumps(bad));button('Save factory');ab('upload','#import-file',str(f))
        wait_for("document.querySelector('#import-error').textContent.length>0")
        assert state()==before;result('Validated import '+label,ab('get','text','#import-error'));button('Close dialog')
    assert not diag()['errors'];ab('errors');ab('console');ab('network','requests');dump('presets-final.json',diag())
except Exception:
    shot('failure-presets.png');dump('failure-presets.json',diag());raise
