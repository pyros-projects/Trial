from browser_checks import *
import traceback
run('open','http://127.0.0.1:8765/index.html');run('wait','--fn','typeof studioDiagnostics === "object"');run('set','viewport',1280,800,1)
checks=[check_creation,check_opening,check_layout_groups,check_field_cancel,check_first_anchor_cancel,check_scrub_cancel,check_large_id,check_paths_text_exports,check_imports_limits,check_snapping,check_focus_cancel,check_group_opacity,check_history_continuity,check_layers_locks,check_mobile,check_clip_and_handles,check_boundaries_reset,check_empty_history_draft,check_native_field_focus,check_keyboard_during_drag]
results=[]
for fn in checks:
 try:
  fn();errors=json.loads(run('errors','--json'))['data']['errors'];assert not errors,errors;results.append({'check':fn.__name__,'result':'pass'});print('PASS',fn.__name__,flush=True)
 except Exception as e:
  results.append({'check':fn.__name__,'result':'fail','error':str(e)});traceback.print_exc();shot('failure-'+fn.__name__+'.png')
 (ROOT/'final-check-results.json').write_text(json.dumps(results,indent=2))
button('Reset');button('Fit');shot('27-final-desktop.png');record('final-desktop-state',state());(ROOT/'final-console.json').write_text(run('console','--json'));(ROOT/'final-errors.json').write_text(run('errors','--json'));(ROOT/'final-network.json').write_text(run('network','requests','--json'))
assert all(r['result']=='pass' for r in results),results
print('ALL AGENT-AUTHORED BROWSER CHECKS PASSED',flush=True)
