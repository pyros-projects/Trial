source=open('evidence/browser-tests.py').read().split("run('set','viewport',1280,800)")[0]
source=source.replace('browser-transcript.txt','large-storage-transcript.txt').replace('browser-results.json','large-storage-results.json').replace("'failure-'","'large-storage-failure-'")
exec(source)
DATABASE_READY='(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open("materia-state-v1",1);q.onsuccess=()=>resolve(q.result);q.onerror=reject;});const record=await new Promise(resolve=>{const q=db.transaction("snapshots").objectStore("snapshots").get("latest");q.onsuccess=()=>resolve(q.result);});db.close();if(!record)return false;const s=JSON.parse(record.json),current=JSON.parse(lab.world.serialize());return s.w===current.w&&s.rng===current.rng&&JSON.stringify(s.arrays)===JSON.stringify(current.arrays);})()'

def large_storage():
    pause();run('upload','#fileInput',str(E/'downloads/stress-512.json'));run('wait','--fn','lab.world.w===512');
    if not js('document.getElementById("storageSettings").open'):run('click','#storageSettings > summary')
    run('uncheck','#autosave');run('check','#autosave');before=signature();run('wait','--fn',DATABASE_READY);assert js(DATABASE_READY);run('uncheck','#autosave')
    click('clearBtn');run('focus','#restoreBtn');run('press','Enter');run('wait','--fn','lab.world.stats().active>60000');assert signature()==before
    run('reload');run('wait','--fn','lab.world.w===512&&lab.world.stats().active>60000');assert signature()==before
    assert state()['paused'];snap('37-large-autosave-restored.png');return {'exact_large_state_hash':before['hash'],'cells':state()['stats']['active'],'restore_after_clear':True,'restore_after_reload':True,'indexeddb_offline':True}
check('Large-state autosave bypasses small-storage quota and restores exactly',large_storage)

def small_cache_regression():
    click('clearBtn');before=signature();
    if not js('document.getElementById("storageSettings").open'):run('click','#storageSettings > summary')
    run('uncheck','#autosave');run('check','#autosave');run('wait','--fn',DATABASE_READY)
    run('reload');run('wait','--fn','lab.world.stats().active===0');assert signature()==before
    run('select','#resolution','256');run('select','#presetSelect','volcano');pause();run('download','#saveBtn',str(E/'downloads/post-storage-world.json'));before=signature();click('clearBtn');run('upload','#fileInput',str(E/'downloads/post-storage-world.json'));run('wait','--fn','lab.world.stats().active>1000');assert signature()==before
    return {'small_snapshot_reload_exact':True,'clear_preserved':True,'file_round_trip_after_storage_change':True}
check('Small-world cache, empty world persistence, and file-load regression',small_cache_regression)
print('Large storage checks finished:',len(results),flush=True)
