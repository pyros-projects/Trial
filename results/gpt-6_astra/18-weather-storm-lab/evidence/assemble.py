from pathlib import Path
p=Path('index.html')
s=p.read_text()
for name in ('model','render','app'):
    start=f'<!-- {name.upper()}_SCRIPT -->'
    end=f'<!-- END_{name.upper()}_SCRIPT -->'
    code=f'{start}\n<script>\n'+Path(f'evidence/{name}.js').read_text()+f'\n</script>\n{end}'
    if end in s:
        a=s.index(start); b=s.index(end,a)+len(end); s=s[:a]+code+s[b:]
    else:s=s.replace(start,code)
p.write_text(s)
