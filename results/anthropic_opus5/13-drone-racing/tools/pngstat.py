#!/usr/bin/env python3
"""Dependency-free PNG stats: size, mean color, black-pixel ratio, sampled pixels, histogram spread.
Usage: pngstat.py file.png [x,y x,y ...]"""
import sys, zlib, struct

def load(path):
    d = open(path,'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'not png'
    i = 8; idat = b''; w=h=bd=ct=None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; data = d[i+8:i+8+ln]; i += 12+ln
        if typ == b'IHDR':
            w,h,bd,ct,_,_,il = struct.unpack('>IIBBBBB', data)
            assert bd == 8 and il == 0 and ct in (2,6), f'unsupported bd={bd} ct={ct} il={il}'
        elif typ == b'IDAT': idat += data
        elif typ == b'IEND': break
    raw = zlib.decompress(idat)
    ch = 3 if ct == 2 else 4
    stride = w*ch
    out = bytearray(h*stride); prev = bytearray(stride); pos = 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if f == 1:
            for x in range(ch, stride): line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                b = prev[x]; c = prev[x-ch] if x >= ch else 0
                p = a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x] = (line[x] + pr) & 255
        out[y*stride:(y+1)*stride] = line; prev = line
    return w,h,ch,out

def main():
    path = sys.argv[1]
    w,h,ch,px = load(path)
    n = w*h; rs=gs=bs=0; black=0; uniq=set()
    for i in range(0, n*ch, ch):
        r,g,b = px[i],px[i+1],px[i+2]
        rs+=r; gs+=g; bs+=b
        if r<8 and g<8 and b<8: black+=1
        if len(uniq)<20000: uniq.add((r>>3,g>>3,b>>3))
    print(f'file={path} size={w}x{h} mean=({rs//n},{gs//n},{bs//n}) black_ratio={black/n:.4f} distinct_colors(5bit)={len(uniq)}')
    for arg in sys.argv[2:]:
        x,y = [int(v) for v in arg.split(',')]
        x=max(0,min(w-1,x)); y=max(0,min(h-1,y)); i=(y*w+x)*ch
        print(f'  px({x},{y}) = ({px[i]},{px[i+1]},{px[i+2]})')

main()
