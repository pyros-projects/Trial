from pathlib import Path
import hashlib, json, runpy, struct, subprocess, zipfile

decode = runpy.run_path('evidence/check-png.py')['decode']
preview = decode(Path('evidence/screenshots/39-export-preview-reference.png').read_bytes())
export = decode(Path('evidence/downloads/final-material.png').read_bytes())
assert preview[:2] == export[:2] == (256, 256)
assert preview[2] == export[2]
results = ['PASS Final PNG has identical decoded RGBA pixels to its paused preview reference.']
with zipfile.ZipFile('evidence/downloads/validation-flow-frames.zip') as z:
    assert z.testzip() is None
    frames = sorted(n for n in z.namelist() if n.endswith('.png'))
    manifest = json.loads(z.read('manifest.json'))
    assert len(frames) == manifest['frames'] == 4
    hashes = set()
    for f in frames:
        data = z.read(f)
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (512, 512)
        hashes.add(hashlib.sha256(data).hexdigest())
    assert len(hashes) == 4
    assert manifest['project']['graph']['nodes']
    results.append('PASS ZIP CRC, manifest and all four distinct 512×512 PNG frames.')
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration','-of','json','evidence/downloads/validation-flow.webm']))
stream = probe['streams'][0]
assert stream['codec_name'] == 'vp9'
assert (stream['width'], stream['height']) == (512, 512)
assert int(stream['nb_read_frames']) > 1
assert .8 < float(probe['format']['duration']) < 1.3
results.append(f"PASS VP9 WebM: 512×512, {stream['nb_read_frames']} decoded frames, {probe['format']['duration']}s.")
Path('evidence/logs/final-export-artifacts.log').write_text('\n'.join(results)+'\n')
Path('evidence/logs/final-png-fidelity.log').write_text(results[0]+'\n')
print('\n'.join(results))
