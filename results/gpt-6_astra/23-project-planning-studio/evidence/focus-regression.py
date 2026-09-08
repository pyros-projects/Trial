from browser_checks import *
reset();fill('Duration for T1','3');ab('press','Tab')
assert js('document.activeElement.getAttribute("aria-label")')=='Priority for T1','Tab must continue into the priority control after recalculation'
ab('press','Control+a');ab('keyboard','type','8');ab('press','Tab');assert js('document.querySelector("[data-id=T1][data-inline=priority]").value')=='8'
reset();fill('Capacity for R1 Studio','2');ab('press','Tab')
assert js('document.activeElement.dataset.resourceEdit')=='R2','Tab must continue to the next resource control'
print('PASS keyboard input continuity')
