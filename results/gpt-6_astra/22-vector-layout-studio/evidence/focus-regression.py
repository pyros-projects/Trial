from ui_helpers import *
field('Selection X',180,False);click('Selection Y');active=ev('document.activeElement.id');assert active=='propY',active
readout('PASS: clicking the next numeric field retains focus after committing the previous field.')
