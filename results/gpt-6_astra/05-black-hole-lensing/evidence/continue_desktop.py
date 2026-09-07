from browser_validation import *
run('press','Escape');run('set','offline','on');snap();click('Classic');run('wait','--fn','Math.abs(Horizon.diagnostics.camera.distance-22)<0.01')
click('Render','tab');click('Performance');run('uncheck','#adaptive');run('uncheck','#taa');click('Environment','tab')
source=(ROOT/'browser_validation.py').read_text()
body=source[source.index("    run('select','#viewMode','0');snap();click('Close ray inspector')"):source.index("\nif __name__")]
body=body.replace("snap();click('Close ray inspector');",'snap();',1)
exec('def remaining():\n'+body)
remaining()
