import re
from pathlib import Path
p=Path('index.html');text=p.read_text()
for identifier,file in [('audio-engine','evidence/audio.js'),('application','evidence/app.js')]:
    code=Path(file).read_text()
    text=re.sub(r'<script id="'+identifier+r'">[\s\S]*?</script>',lambda m:'<script id="'+identifier+'">\n'+code+'\n</script>',text)
p.write_text(text)
