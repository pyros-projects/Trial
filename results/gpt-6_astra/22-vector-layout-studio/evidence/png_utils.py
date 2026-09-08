import struct,zlib
from pathlib import Path
def png_info(path):
 b=Path(path).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';w,h,depth,ctype,_,_,interlace=struct.unpack('>IIBBBBB',b[16:29]);return w,h,depth,ctype,interlace
def png_pixel(path,x,y):
 b=Path(path).read_bytes();w,h,depth,ctype,interlace=png_info(path);assert depth==8 and not interlace and ctype in [2,6];channels=4 if ctype==6 else 3;raw=b'';pos=8
 while pos<len(b):
  n=struct.unpack('>I',b[pos:pos+4])[0];kind=b[pos+4:pos+8]
  if kind==b'IDAT':raw+=b[pos+8:pos+8+n]
  pos+=12+n
 data=zlib.decompress(raw);stride=w*channels;prev=bytearray(stride)
 for row in range(y+1):
  start=row*(stride+1);f=data[start];cur=bytearray(data[start+1:start+1+stride])
  for i in range(stride):
   a=cur[i-channels] if i>=channels else 0;up=prev[i];c=prev[i-channels] if i>=channels else 0
   if f==1:cur[i]=(cur[i]+a)&255
   elif f==2:cur[i]=(cur[i]+up)&255
   elif f==3:cur[i]=(cur[i]+((a+up)//2))&255
   elif f==4:
    p=a+up-c;pa=abs(p-a);pb=abs(p-up);pc=abs(p-c);cur[i]=(cur[i]+(a if pa<=pb and pa<=pc else up if pb<=pc else c))&255
  prev=cur
 p=tuple(prev[x*channels:(x+1)*channels]);return p if channels==4 else p+(255,)
