# Test harness (not part of the delivered artifact)

`index.html` is standalone and depends on none of this. These files exist only to validate it.

```bash
node extract-core.js   # pull the simulation code out of ../../index.html into core.js
node test1.js          # 288-mission generation validity
node test2.js          # traversability (48 missions), stability with guards, determinism
node test3.js          # 26 assertions on perception, hearing, pursuit, radio, gadgets, cameras, noise
node seedsearch.js     # find compact seeds a cautious policy can complete
```

`pilot.js` is injected into the running page with `agent-browser eval --stdin`. It reads live game
state and dispatches **real** `KeyboardEvent`s — it never mutates simulation state. It is a scripted
hand on a keyboard, used so long traversals can be driven without a human.
