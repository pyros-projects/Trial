import base64, json, struct, zlib
from pathlib import Path

def decode(data):
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    p=8; compressed=b''
    while p<len(data):
        n=struct.unpack('>I',data[p:p+4])[0]; kind=data[p+4:p+8]; body=data[p+8:p+8+n];p+=12+n
        if kind==b'IHDR': w,h,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',body)
        elif kind==b'IDAT': compressed+=body
    assert depth==8 and color in (2,6) and interlace==0
    bpp=4 if color==6 else 3; stride=w*bpp; packed=zlib.decompress(compressed);out=bytearray();previous=bytearray(stride);at=0
    for y in range(h):
        filter=packed[at]; row=bytearray(packed[at+1:at+1+stride]);at+=stride+1
        for x in range(stride):
            a=row[x-bpp] if x>=bpp else 0;b=previous[x];c=previous[x-bpp] if x>=bpp else 0
            if filter==1: n=a
            elif filter==2: n=b
            elif filter==3: n=(a+b)//2
            elif filter==4:
                q=a+b-c;ds=[abs(q-a),abs(q-b),abs(q-c)];n=[a,b,c][ds.index(min(ds))]
            else: n=0
            row[x]=(row[x]+n)%256
        if bpp==4:out.extend(row)
        else:
            for x in range(0,stride,3):out.extend(row[x:x+3]);out.append(255)
        previous=row
    return w,h,bytes(out)

raw=json.loads(Path('evidence/logs/png-preview-reference.json').read_text())['data']['result']
a=decode(base64.b64decode(raw.split(',')[1]));b=decode(Path('evidence/downloads/validation-flow-f0086-256.png').read_bytes())
assert a[:2]==b[:2]==(256,256)
assert a[2]==b[2], 'PNG export must match the same graph, frame and resolution pixel for pixel'
colors=len(set(b[2][i:i+4] for i in range(0,len(b[2]),4)))
assert colors>1000
message=f'PASS PNG: 256x256; pixel-identical to paused final preview; {colors} distinct RGBA colors.\n'
Path('evidence/logs/png-fidelity.log').write_text(message);print(message)
