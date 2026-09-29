# Extracts the pure generator+simulation section of ../index.html into core.js for the Node harnesses
# (harness.js, bot2.js, perf.js read ./core.js). Usage: python3 extract-core.py && node harness.js
s = open('../../index.html').read()
a = s.index('/* ======================= GENERATOR'); b = s.index('/* ======================= RENDERING')
head = s[s.index('<script>') + 8:a]
open('core.js', 'w').write(head + s[a:b])
print('core.js written')
