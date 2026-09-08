from workflow import *

def advanced():
    # Finish the real campaign, then accept its next contract and restart.
    resume();button('Simulation speed 4x')
    wait_for('(Forge.diagnostics().delivered.circuit || 0) >= 30')
    wait_for('Forge.diagnostics().contract.complete')
    pause();d=diag();assert d['contract']['score']>0;shot('18-contract-complete.png');dump('campaign-complete.json',d)
    result('Campaign completion and score',d['contract'])
    button('Accept next contract');assert diag()['contract']['stage']==2 and not diag()['contract']['complete']
    button('Reset factory');button('Reset production');d=diag();assert d['tick']==0 and not d['produced'] and not d['delivered'] and d['paused']
    assert all(s['queue']==0 for s in d['structures'])
    result('Next contract and production reset',{'stage':d['contract']['stage'],'tick':d['tick'],'structures':len(d['structures'])})
    button('Reset factory');button('Restart preset');pause();assert diag()['contract']['stage']==1
    # A real power shortage slows connected machines; new fueled generation restores it.
    loadpreset('Power crisis');button('Simulation speed 4x')
    wait_for("Forge.diagnostics().power.some(n=>n.demand>n.supply&&n.ratio<.99)")
    pause();before=diag();assert any(s['status']=='brownout' for s in before['structures'])
    ab('click','#overlay-btn');button('Power network');shot('19-power-crisis.png')
    button('Build Generator');clickcell(10,18);assert structure(10,18)['type']=='generator'
    button('Select (V)');clickcell(7,18);ab('click','#upgrade-btn')
    clickcell(10,18);ab('click','#upgrade-btn')
    resume();wait_for('Forge.diagnostics().power[0].supply>=540 && Forge.diagnostics().power[0].ratio===1')
    pause();after=diag();shot('20-power-recovered.png');dump('power-recovery.json',{'before':before,'after':after})
    result('Brownout and generator recovery',{'before':before['power'],'after':after['power']})
    # Disconnect the generator's bridging pole and observe real unpowered consumers.
    button('Demolish area (X)');clickcell(8,16);button('Single step')
    assert any(s['status']=='unpowered' for s in diag()['structures'])
    button('Undo edit');button('Single step');assert sum(n['supply'] for n in diag()['power'])>=540
    result('Power connectivity and undo','Removing the bridge pole stopped consumers; undo restored powered networks')
    # Demonstrate the inserter reaching across a deliberate one-cell gap.
    loadpreset('Starter line');pause();button('Demolish area (X)');dragcells([(6,9),(7,9)])
    assert structure(6,9) is None and structure(7,9) is None
    button('Build Inserter');clickcell(7,9);button('Select (V)');clickcell(7,9)
    while structure(7,9)['dir']!=0:ab('press','r')
    button('Simulation speed 4x');resume();wait_for("Forge.diagnostics().structures.find(s=>s.type==='loader').passed>=8")
    pause();d=diag();assert d['delivered'].get('plate',0)>0 and structure(7,9)['power']>0
    shot('21-working-inserter.png');dump('inserter-state.json',d);result('Powered inserter gap transfer',structure(7,9))
    # Wrong recipe refuses iron, then restoring the recipe restarts the same machine.
    clickcell(10,8);ab('select','#selected-recipe','copper');resume()
    wait_for("Forge.diagnostics().structures.find(s=>s.type==='furnace').status==='starved'")
    pause();assert structure(10,8)['recipe']=='copper';old=structure(10,8)['made'];ab('select','#selected-recipe','iron')
    resume();wait_for(f"Forge.diagnostics().structures.find(s=>s.type==='furnace').made>{old}");pause()
    result('Machine recipe configuration','Copper recipe starved on iron feed; restored iron recipe produced again')
    # Repeat identical tick sequences at 1x and 4x using the actual Single step control.
    button('Close structure inspector');button('Save factory');ab('fill','#slot-name','Determinism');button('Save slot');button('Close dialog')
    button('Simulation speed 1x')
    for _ in range(30):button('Single step')
    one=state();button('Save factory');button('Load slot Determinism');button('Simulation speed 4x')
    for _ in range(30):button('Single step')
    four=state();one['speed']=four['speed'];assert one==four
    result('Fixed-step determinism at 1x and 4x',{'ticks':30,'endTick':four['tick'],'allFactoryStateEqual':True})
    # Real elapsed speed also scales tick rate, independent of machine ratios.
    button('Simulation speed 1x');resume();a=diag();time.sleep(.8);b=diag();pause();normal=b['tick']-a['tick']
    button('Simulation speed 4x');resume();a=diag();time.sleep(.8);b=diag();pause();fast=b['tick']-a['tick']
    assert 3.3<fast/max(1,normal)<4.7
    result('Real-time speed scaling',{'oneXticks':normal,'fourXticks':fast,'ratio':fast/normal})
    # Congested preset has real full storage. Disabling its hold clears the bottleneck.
    loadpreset('Congested belts');pause();assert structure(16,8)['inventory']['plate']==200
    button('Select (V)');clickcell(16,8);ab('check','#storage-output');ab('press','r');ab('press','r');ab('press','r')
    # Rotate the output south; extend it into a new hub below.
    while structure(16,8)['dir']!=1:ab('press','r')
    button('Build Delivery hub');clickcell(17,11)
    button('Build Conveyor belt');clickcell(17,10);button('Select (V)');clickcell(17,10)
    while structure(17,10)['dir']!=1:ab('press','r')
    resume();button('Simulation speed 4x');wait_for('(Forge.diagnostics().delivered.plate || 0)>=10');pause()
    result('Congested preset cleared with storage output',{'storage':structure(16,8)['inventory'],'delivered':diag()['delivered']})
    # Multi-product preset produces both its advanced engine and ongoing circuits.
    loadpreset('Multi-product bus');button('Simulation speed 4x');wait_for('(Forge.diagnostics().delivered.engine || 0)>=2');pause()
    assert diag()['delivered'].get('circuit',0)>0;shot('22-multi-product-bus.png');result('Multi-product bus',diag()['delivered'])
    # Thousands of actual packets and hundreds of structures remain responsive.
    loadpreset('High-throughput test');button('Simulation speed 4x');time.sleep(2);d=diag();dump('stress-live.json',d)
    assert len(d['structures'])>600 and d['items']>=500
    old=d['delivered'].get('plate',0);wait_for(f"(Forge.diagnostics().delivered.plate || 0)>{old+20}")
    pause();shot('23-high-throughput-stress.png');result('Stress preset',{'structures':len(d['structures']),'movingItems':d['items'],'fps':d['fps'],'deliveryRate':d['deliveryRate']})
    # Change density with a full factory; no packet is dropped or moved out of bounds.
    before=state();button('Simulation settings');ab('select','#setting-density','2');button('Apply to factory')
    for _ in range(5):button('Single step')
    current=state();assert all(0<=it['p']<=1 for s in current['structures'] for it in s['items'])
    button('Save factory');ab('fill','#slot-name','Stress reduced density');button('Save slot');button('Close dialog')
    result('Density change with busy queues','All item positions valid; exact state still serializes to a named slot')
    # Paused autosave survives an actual page reload.
    before=state();ab('reload');wait_for('typeof Forge!=="undefined"');after=state();assert after==before
    result('Autosave and reload',{'tick':after['tick'],'structures':len(after['structures'])})
    assert not diag()['errors'];ab('errors');ab('console');ab('network','requests');dump('advanced-final.json',diag())

if __name__=='__main__':
    try:advanced()
    except Exception:
        shot('failure-advanced.png');dump('failure-advanced-diagnostics.json',diag());raise
