import importlib.util,time
sp=importlib.util.spec_from_file_location('checks','evidence/browser-checks.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
ab,ev,click,check=m.ab,m.ev,m.click,m.check
ab('set','viewport',1280,800);ab('network','route','https://*','--abort');ab('network','route','http://*','--abort');ab('set','offline','on');ab('open',m.ROOT.joinpath('index.html').as_uri());ab('wait','--fn','!!window.ecoLab')
if not ev('ecoLab.view.paused'):click('Pause')
m.load('evolved-browser-save.json');click('Lineage');parent=ev('ecoLab.state.lineage[ecoLab.view.selected].parent');ab('click',f'[data-ancestor="{parent}"]');ab('click','#inspectAncestor')
ab('download','#saveBtn','evidence/archived-selection.json');click('Reset');m.load('archived-selection.json')
actual=ev('document.getElementById("sizeValue").textContent');expected=ev('(ecoLab.state.lineage[ecoLab.view.selected].genes.size*8).toFixed(1)+" u"')
check('archived_size_after_load',actual==expected,{'actual':actual,'expected':expected,'selected':ev('ecoLab.view.selected'),'archived':ev('!ecoLab.state.byId.has(ecoLab.view.selected)')})
time.sleep(.5);ab('screenshot','evidence/archived-inspector.png');click('Lineage');ab('press','Escape');click('Reset');click('Single step');check('archive_regression_step',ev('ecoLab.state.tick')==1 and ev('ecoLab.view.paused'),{'tick':ev('ecoLab.state.tick')});check('archive_console_clean',not ab('errors').get('errors'),ab('errors').get('errors'))
