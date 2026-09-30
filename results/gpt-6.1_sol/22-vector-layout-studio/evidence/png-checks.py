import struct,zlib,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parent

def chunks(path):
 b=path.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';i=8;out=[]
 while i<len(b):
  n=struct.unpack('>I',b[i:i+4])[0];typ=b[i+4:i+8];out.append((typ,b[i+8:i+8+n]));i+=n+12
 return out

def dimensions(path):
 c=chunks(path);return struct.unpack('>II',c[0][1][:8])
def rgba(path):
 c=chunks(path);w,h,depth,typ,_,_,interlace=struct.unpack('>IIBBBBB',c[0][1]);assert (depth,typ,interlace)==(8,6,0)
 data=zlib.decompress(b''.join(v for k,v in c if k==b'IDAT'));stride=w*4;out=bytearray();prev=bytearray(stride);pos=0
 for row in range(h):
  filt=data[pos];cur=bytearray(data[pos+1:pos+1+stride]);pos+=stride+1
  for i in range(stride):
   a=cur[i-4] if i>=4 else 0;b=prev[i];cc=prev[i-4] if i>=4 else 0
   if filt==1:v=a
   elif filt==2:v=b
   elif filt==3:v=(a+b)//2
   elif filt==4:
    p=a+b-cc;pa,pb,pc=abs(p-a),abs(p-b),abs(p-cc);v=a if pa<=pb and pa<=pc else b if pb<=pc else cc
   else:v=0
   cur[i]=(cur[i]+v)&255
  out.extend(cur);prev=cur
 return w,h,out
pairs={'artwork-1x.png':(1200,800),'artwork-2x.png':(2400,1600),'mobile-transparent.png':(640,640),'maximum-4096.png':(4096,4096),'direct.png':(960,680),'opaque/Room-for-ideas.png':(960,680)}
results=[]
for name,size in pairs.items():
 path=ROOT/'downloads'/name;actual=dimensions(path);assert actual==size,(name,actual);results.append({'file':name,'dimensions':actual,'pass':True});print('PASS',name,actual)
w,h,pixels=rgba(ROOT/'downloads'/'mobile-transparent.png');assert list(pixels[:4])==[0,0,0,0] and any(pixels[i] for i in range(3,len(pixels),4));print('PASS transparent PNG has zero-alpha corner and painted scene pixels')
(ROOT/'png-results.json').write_text(json.dumps(results,indent=2))
