import struct,zlib,tarfile,io,json,hashlib,pathlib
p=pathlib.Path(__file__).parent/'downloads'
def readpng(b):
 assert b[:8]==b'\x89PNG\r\n\x1a\n'
 off=8;idata=b''
 while off<len(b):
  n=struct.unpack('>I',b[off:off+4])[0];kind=b[off+4:off+8];chunk=b[off+8:off+8+n];off+=n+12
  if kind==b'IHDR':w,h,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',chunk)
  if kind==b'IDAT':idata+=chunk
 assert depth==8 and color in (2,6) and interlace==0
 channels=4 if color==6 else 3;stride=w*channels;raw=zlib.decompress(idata);prev=bytearray(stride);pixels=bytearray()
 def paeth(a,b,c):
  t=a+b-c;pa,pb,pc=abs(t-a),abs(t-b),abs(t-c)
  return a if pa<=pb and pa<=pc else b if pb<=pc else c
 for y in range(h):
  row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)]);f=raw[y*(stride+1)]
  for x in range(stride):
   a=row[x-channels] if x>=channels else 0;b=prev[x];c=prev[x-channels] if x>=channels else 0
   row[x]=(row[x]+(0 if f==0 else a if f==1 else b if f==2 else (a+b)//2 if f==3 else paeth(a,b,c)))&255
  pixels.extend(row);prev=row
 return w,h,channels,bytes(pixels)
w,h,c,pix=readpng((p/'currents.png').read_bytes());assert (w,h)==(256,256);assert len(set(pix))>100
result=[f'PASS: PNG decoded, {w} × {h}, {c} channels, {len(set(pix))} distinct channel values.']
with tarfile.open(p/'currents-frames.tar') as t:
 m=json.load(t.extractfile('manifest.json'));hashes=[]
 for name in t.getnames():
  if name.endswith('.png'):
   w,h,c,pix=readpng(t.extractfile(name).read());assert(w,h)==(256,256);hashes.append(hashlib.sha256(pix).hexdigest())
 assert len(hashes)==4 and len(set(hashes))==4
 result.append('PASS: Four valid PNG frames, all 256 × 256, all pixel hashes distinct.')
 result.append('Manifest: '+json.dumps(m))
(p.parent/'export-verification.txt').write_text('\n'.join(result)+'\n');print('\n'.join(result))
