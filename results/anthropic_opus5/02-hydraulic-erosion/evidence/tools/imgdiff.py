#!/usr/bin/env python3
"""Mean absolute pixel difference between two PNGs over an optional crop box."""
import sys, zlib, struct
def readpng(path):
    d=open(path,'rb').read(); assert d[:8]==b'\x89PNG\r\n\x1a\n'
    i=8; idat=b''; w=h=0; ct=0
    while i<len(d):
        ln=struct.unpack('>I',d[i:i+4])[0]; typ=d[i+4:i+8]; data=d[i+8:i+8+ln]; i+=12+ln
        if typ==b'IHDR': w,h,_,ct=struct.unpack('>IIBB',data[:10])
        elif typ==b'IDAT': idat+=data
        elif typ==b'IEND': break
    raw=zlib.decompress(idat); ch={0:1,2:3,4:2,6:4}[ct]; stride=w*ch
    out=bytearray(); prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
        for x in range(stride):
            a=line[x-ch] if x>=ch else 0; b=prev[x]; c=prev[x-ch] if x>=ch else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+b)&255
            elif f==3: line[x]=(line[x]+(a+b)//2)&255
            elif f==4:
                pp=a+b-c; pa=abs(pp-a); pb=abs(pp-b); pc=abs(pp-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out+=line; prev=line
    return w,h,ch,bytes(out)
a=sys.argv[1]; b=sys.argv[2]
box=[int(v) for v in sys.argv[3].split(',')] if len(sys.argv)>3 else None
w1,h1,c1,p1=readpng(a); w2,h2,c2,p2=readpng(b)
assert (w1,h1)==(w2,h2), 'size mismatch'
x0,y0,x1,y1 = box if box else (0,0,w1,h1)
tot=0; n=0; changed=0
for y in range(y0,y1,2):
    for x in range(x0,x1,2):
        o=(y*w1+x)*c1
        d=max(abs(p1[o]-p2[o]),abs(p1[o+1]-p2[o+1]),abs(p1[o+2]-p2[o+2]))
        tot+=d; n+=1
        if d>8: changed+=1
print(f'meanAbsDiff={tot/max(n,1):.2f} pctPixelsChanged={100*changed/max(n,1):.1f}% samples={n}')
