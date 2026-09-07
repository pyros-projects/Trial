#!/usr/bin/env python3
"""Zero-dependency, read-only gallery for one artifact per agentic run.

results/<model>/<run>/{index.html | project/ | project.zip}
Optional: metadata.json, report.json, screenshot.*, notes.md, evidence/.
Never installs, launches or extracts submitted code.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import math
import mimetypes
import threading
import webbrowser
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
try:
    from .projects import project_summary, project_zip, validate_preview_url
except ImportError:
    from projects import project_summary, project_zip, validate_preview_url

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = PACKAGE_ROOT / 'gallery/static'
RESULTS_ROOT = PACKAGE_ROOT / 'results'
PROMPTS_ROOT = PACKAGE_ROOT / 'prompts'
CATALOG_PATH = PROMPTS_ROOT / 'catalog.json'
HTML_NAMES = ('index.html', 'result.html', 'app.html')
SCREENSHOT_NAMES = tuple(f'{name}{ext}' for name in ('screenshot', 'preview') for ext in ('.png','.webp','.jpg','.jpeg'))
PUBLIC_FILES = set(HTML_NAMES + SCREENSHOT_NAMES + ('project.zip','report.json'))


def utc_iso(timestamp: float | None = None) -> str:
    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc) if timestamp is not None else datetime.now(timezone.utc)
    return dt.isoformat(timespec='seconds').replace('+00:00','Z')


def load_json(path: Path | None, default: Any) -> Any:
    try:
        if path is None or path.is_symlink() or path.stat().st_size > 8 * 1024 * 1024:
            return default
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError, UnicodeError, RecursionError):
        return default


def file_sha256(path: Path | None) -> str | None:
    if path is None:
        return None
    try:
        with path.open('rb') as handle:
            return hashlib.file_digest(handle, 'sha256').hexdigest()
    except OSError:
        return None


def safe_relative_file(base: Path, raw: str) -> Path | None:
    try:
        raw = unquote(raw).lstrip('/')
        if '\\' in raw or '\x00' in raw:
            return None
        parts = raw.split('/')
        if not parts or any(p in {'','.', '..'} for p in parts):
            return None
        candidate = base
        for part in parts:
            candidate = candidate / part
            if candidate.is_symlink():
                return None
        resolved = candidate.resolve()
        return resolved if base.resolve() in resolved.parents and resolved.is_file() else None
    except (OSError, RuntimeError, ValueError):
        return None


def coerce_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (float,int,str)):
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) and 0 <= number <= 100 else None
    except (ValueError, OverflowError):
        return None


def score_from_value(value: Any) -> float | None:
    return coerce_number(value.get('total')) if isinstance(value, dict) else coerce_number(value)


def real_directory(path: Path) -> bool:
    return path.is_dir() and not path.is_symlink()


def find_named(files: dict[str, Path], names: tuple[str, ...]) -> Path | None:
    return next((files[name] for name in names if name in files), None)


@dataclass
class GalleryState:
    artifact_origin: str

    def __post_init__(self) -> None:
        self.catalog = load_json(CATALOG_PATH, [])
        self.catalog_by_id = {t['id']:t for t in self.catalog}

    def artifact_url(self, path: Path | None) -> str | None:
        if path is None:
            return None
        relative = '/'.join(quote(part, safe='') for part in path.relative_to(RESULTS_ROOT).parts)
        return f'{self.artifact_origin}/{relative}'

    def prompt_urls(self, task_id: str | None) -> dict[str, str | None]:
        if task_id not in self.catalog_by_id:
            return {'prompt':None, 'acceptance':None}
        base=f'/prompts/{quote(task_id,safe="")}'
        return {'prompt':f'{base}/prompt.md','acceptance':f'{base}/acceptance.md'}

    def infer_task_id(self, metadata: dict[str, Any], run_name: str, manifest: Any = None) -> str | None:
        declared = metadata.get('task_id') or metadata.get('task')
        if isinstance(declared, str):
            return declared
        if isinstance(manifest,dict) and isinstance(manifest.get('task_id'),str):
            return manifest['task_id']
        return next((ident for ident in self.catalog_by_id if ident in run_name.lower()),None)

    def artifact_payload(self, run: Path, files: dict[str, Path], metadata: dict, report: dict) -> dict:
        html=find_named(files,HTML_NAMES)
        shot=find_named(files,SCREENSHOT_NAMES)
        project=run/'project'
        archive=files.get('project.zip')
        warnings=[]
        kinds=int(html is not None)+int(real_directory(project))+int(archive is not None)
        if kinds>1:
            warnings.append('Multiple artifacts found. Keep one index.html, project/ or project.zip; HTML takes precedence, then project/.')
        result={'exists':kinds>0,'kind':'missing','filename':None,'url':None,'source_url':None,
                'screenshot_url':self.artifact_url(shot),'report_url':self.artifact_url(files.get('report.json')),
                'bytes':None,'file_count':0,'sha256':None,'manifest':None,'checks':[],'warning':None}
        if html:
            result.update(kind='html',filename=html.name,url=self.artifact_url(html),source_url=self.artifact_url(html),
                          bytes=html.stat().st_size,file_count=1,sha256=file_sha256(html))
        elif real_directory(project):
            result.update(kind='project',filename='project/')
            try:
                result.update(project_summary(project))
                result['source_url']='/api/source.zip?'+urlencode({'run':f'{run.parent.name}/{run.name}'})
            except (OSError,ValueError) as error:
                warnings.append(str(error))
            manifest=load_json(project/'benchmark.json',None)
            if isinstance(manifest,dict):
                result['manifest']=manifest
            else:
                warnings.append('benchmark.json is absent or invalid; inspect the README before running.')
        elif archive:
            result.update(kind='archive',filename='project.zip',source_url=self.artifact_url(archive),
                          bytes=archive.stat().st_size,file_count=None,sha256=file_sha256(archive))
            warnings.append('Archive is not extracted or executed. Inspect its contents before running.')
        if metadata.get('preview_url') and result['kind'] in {'project','archive'}:
            try:
                result['url']=validate_preview_url(metadata['preview_url'])
            except ValueError as error:
                warnings.append(str(error))
        checks=report.get('checks',[])
        if isinstance(checks,list):
            result['checks']=[c for c in checks[:1000] if isinstance(c,dict) and isinstance(c.get('id'),str) and c.get('status') in {'pass','fail','blocked','not-run'}]
        result['warning']=' '.join(warnings) or None
        return result

    def scan(self) -> list[dict[str, Any]]:
        RESULTS_ROOT.mkdir(parents=True,exist_ok=True)
        results=[]
        for model in sorted(RESULTS_ROOT.iterdir()):
            if not real_directory(model) or model.name.startswith('.'):
                continue
            for run in sorted(model.iterdir()):
                if not real_directory(run) or run.name.startswith('.'):
                    continue
                files={p.name.lower():p for p in run.iterdir() if p.is_file() and not p.is_symlink()}
                if not (set(files)&(set(HTML_NAMES)|{'project.zip','metadata.json'}) or real_directory(run/'project')):
                    continue
                metadata=load_json(files.get('metadata.json'),{})
                metadata=metadata if isinstance(metadata,dict) else {}
                report=load_json(files.get('report.json'),{})
                report=report if isinstance(report,dict) else {}
                artifact=self.artifact_payload(run,files,metadata,report)
                task_id=self.infer_task_id(metadata,run.name,artifact['manifest'])
                task=self.catalog_by_id.get(task_id,{})
                score=score_from_value(metadata.get('score'))
                if score is None:
                    score=score_from_value(report)
                binding='none' if not report else 'unbound'
                if report.get('artifact_sha256'):
                    binding='match' if report['artifact_sha256']==artifact['sha256'] else 'stale'
                published_score=score if binding!='stale' else None
                notes=metadata.get('notes','')
                if not notes:
                    note=files.get('notes.md') or files.get('notes.txt')
                    if note and note.stat().st_size<=256*1024:
                        try:notes=note.read_text(encoding='utf-8')
                        except (OSError,UnicodeError):notes='Notes could not be decoded.'
                tags=metadata.get('tags',[])
                if isinstance(tags,str):tags=[tags]
                if not isinstance(tags,list):tags=[]
                counts={key:sum(c['status']==key for c in artifact['checks']) for key in ('pass','fail','blocked','not-run')}
                timestamps=[run.stat().st_mtime]+[p.stat().st_mtime for p in files.values()]
                results.append({'id':f'{model.name}/{run.name}','model_key':model.name,
                    'model':str(metadata.get('model') or metadata.get('model_name') or model.name),
                    'model_version':metadata.get('model_version'), 'provider':metadata.get('provider'),
                    'run_key':run.name,'run_id':str(metadata.get('run_id') or run.name),'task_id':task_id,
                    'task_title':task.get('title') or metadata.get('task_title') or task_id or 'Unassigned task',
                    'category':task.get('category','Uncategorized'),'icon':task.get('icon','◇'),
                    'description':task.get('description',''),
                    'track':task.get('track') or metadata.get('track') or ('real-apps' if artifact['kind'] in {'project','archive'} else 'html'),
                    'rubric':task.get('rubric') or metadata.get('rubric'),
                    'created_at':metadata.get('created_at'),'modified_at':utc_iso(max(timestamps)),
                    'tags':[str(t) for t in tags], 'notes':str(notes),
                    'parameters':metadata.get('parameters',{}),'environment':metadata.get('environment',{}),
                    'metrics':metadata.get('metrics',{}),'score':published_score,'reported_score':score,
                    'score_details':metadata.get('score') if isinstance(metadata.get('score'),dict) else report,
                    'report_binding':binding,'checks':counts,'artifact':artifact,
                    'prompts':self.prompt_urls(task_id),'metadata':metadata})
        return sorted(results,key=lambda r:(r['model'].lower(),r['run_id'].lower()))

    def summary(self,results: list[dict]) -> dict:
        scores=[r['score'] for r in results if r['score'] is not None]
        return {'models':len({r['model_key'] for r in results}),'runs':len(results),
                'tasks':len({r['task_id'] for r in results if r['task_id'] in self.catalog_by_id}),
                'scored_runs':len(scores),'average_score':sum(scores)/len(scores) if scores else None,
                'artifacts':sum(r['artifact']['exists'] for r in results)}

    def data(self) -> dict:
        results=self.scan()
        return {'generated_at':utc_iso(),'artifact_origin':self.artifact_origin,'catalog':self.catalog,
                'summary':self.summary(results),'results':results}


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True


class CommonHandler(BaseHTTPRequestHandler):
    server_version='TrialByPyroGallery/4.0'
    def log_message(self,format_string: str,*args: Any) -> None:
        if getattr(self.server,'verbose',False):super().log_message(format_string,*args)
    def send_bytes(self,body: bytes,content_type: str,status: HTTPStatus=HTTPStatus.OK,extra_headers: dict | None=None) -> None:
        self.send_response(status.value)
        for key,value in {'Content-Type':content_type,'Content-Length':str(len(body)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',**(extra_headers or {})}.items():
            self.send_header(key,value)
        self.end_headers()
        if self.command!='HEAD':
            try:self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError):pass
    def send_json(self,payload: Any,status: HTTPStatus=HTTPStatus.OK) -> None:
        self.send_bytes(json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode(),'application/json; charset=utf-8',status)
    def send_file(self,path: Path,content_type: str | None=None,headers: dict | None=None) -> None:
        try:body=path.read_bytes()
        except OSError:self.send_error(404);return
        content_type=content_type or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        if content_type.startswith('text/') or content_type in {'application/json','application/javascript','image/svg+xml'}:content_type+='; charset=utf-8'
        self.send_bytes(body,content_type,extra_headers=headers)
    def do_HEAD(self) -> None:self.do_GET()


def csv_cell(value: Any) -> Any:
    if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@','\t','\r')):
        return "'"+value
    return value


def csv_export(results: list[dict]) -> bytes:
    output=io.StringIO(newline='')
    fields=['model','model_version','run_id','task_id','task_title','track','score','report_binding','artifact_kind','artifact_sha256','passed','failed','blocked','not_run','modified_at','tags','notes']
    writer=csv.DictWriter(output,fieldnames=fields);writer.writeheader()
    for r in results:
        row={key:r.get(key) or '' for key in fields}
        row.update(score=r['score'] if r['score'] is not None else '',artifact_kind=r['artifact']['kind'],artifact_sha256=r['artifact']['sha256'] or '',passed=r['checks']['pass'],failed=r['checks']['fail'],blocked=r['checks']['blocked'],not_run=r['checks']['not-run'],tags=' | '.join(r['tags']),notes=r['notes'].replace('\n',' ').replace('\r',' '))
        writer.writerow({k:csv_cell(v) for k,v in row.items()})
    return output.getvalue().encode('utf-8-sig')


def make_artifact_handler() -> type[CommonHandler]:
    class ArtifactHandler(CommonHandler):
        def do_GET(self) -> None:
            parsed=urlparse(self.path)
            if parsed.path=='/health':self.send_json({'status':'ok'});return
            parts=unquote(parsed.path).strip('/').split('/')
            if len(parts)!=3 or parts[-1].lower() not in PUBLIC_FILES:
                self.send_error(404);return
            path=safe_relative_file(RESULTS_ROOT,parsed.path)
            if path is None:self.send_error(404);return
            headers={'Cross-Origin-Resource-Policy':'cross-origin','Referrer-Policy':'no-referrer'}
            if parse_qs(parsed.query).get('download')==['1']:
                headers['Content-Disposition']=f'attachment; filename="{path.name}"'
            self.send_file(path,headers=headers)
    return ArtifactHandler


def source_project(run_key: str) -> Path | None:
    parts=run_key.split('/')
    if len(parts)!=2 or any(p in {'','.', '..'} or '\\' in p or '\x00' in p for p in parts):
        return None
    current=RESULTS_ROOT
    for part in (*parts,'project'):
        current=current/part
        if not real_directory(current):return None
    resolved=current.resolve()
    return resolved if RESULTS_ROOT.resolve() in resolved.parents else None


def make_gallery_handler(state: GalleryState) -> type[CommonHandler]:
    class GalleryHandler(CommonHandler):
        def do_GET(self) -> None:
            parsed=urlparse(self.path);path=parsed.path
            if path in ('/','/index.html'):self.send_file(STATIC_ROOT/'index.html','text/html');return
            if path=='/api/data':self.send_json(state.data());return
            if path=='/api/results':self.send_json(state.scan());return
            if path=='/api/catalog':self.send_json(state.catalog);return
            if path=='/health':self.send_json({'status':'ok','artifact_origin':state.artifact_origin});return
            if path=='/api/export.csv':
                self.send_bytes(csv_export(state.scan()),'text/csv; charset=utf-8',extra_headers={'Content-Disposition':'attachment; filename="agentic-results.csv"'});return
            if path=='/api/source.zip':
                project=source_project(parse_qs(parsed.query).get('run',[''])[0])
                if project is None:self.send_error(400);return
                try:body=project_zip(project)
                except (OSError,ValueError) as error:self.send_json({'error':str(error)},HTTPStatus.BAD_REQUEST);return
                self.send_bytes(body,'application/zip',extra_headers={'Content-Disposition':'attachment; filename="project-source.zip"'});return
            if path.startswith('/prompts/'):
                target=safe_relative_file(PROMPTS_ROOT,path[len('/prompts/'):])
                if target is None:self.send_error(404);return
                self.send_file(target,'text/plain');return
            target=safe_relative_file(STATIC_ROOT,path)
            if target is not None:self.send_file(target);return
            self.send_error(404)
    return GalleryHandler


def build_parser() -> argparse.ArgumentParser:
    p=argparse.ArgumentParser(description='Serve the Trial by Pyro gallery; never execute submitted code.')
    p.add_argument('--host',default='127.0.0.1')
    p.add_argument('--port',type=int,default=8765)
    p.add_argument('--artifact-port',type=int,default=8766)
    p.add_argument('--public-host',default=None)
    p.add_argument('--results-dir',type=Path,default=RESULTS_ROOT)
    p.add_argument('--open',action='store_true');p.add_argument('--verbose',action='store_true')
    return p


def main() -> int:
    global RESULTS_ROOT
    args=build_parser().parse_args();RESULTS_ROOT=args.results_dir.expanduser().resolve()
    RESULTS_ROOT.mkdir(parents=True,exist_ok=True)
    artifact=None;gallery=None
    try:
        artifact=QuietThreadingHTTPServer((args.host,args.artifact_port),make_artifact_handler())
        artifact.verbose=args.verbose
        host=args.public_host or ('127.0.0.1' if args.host=='0.0.0.0' else args.host)
        origin=f'http://{host}:{artifact.server_address[1]}'
        state=GalleryState(origin)
        gallery=QuietThreadingHTTPServer((args.host,args.port),make_gallery_handler(state))
        gallery.verbose=args.verbose
    except OSError as error:
        if artifact:artifact.server_close()
        print(f'Cannot start gallery: {error}');return 1
    thread=threading.Thread(target=artifact.serve_forever,daemon=True);thread.start()
    url=f'http://{host}:{gallery.server_address[1]}/'
    print(f'Gallery: {url}\nArtifacts: {origin}\nResults: {RESULTS_ROOT}\nNo submitted code is started automatically.',flush=True)
    if args.open:webbrowser.open(url)
    try:gallery.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        artifact.shutdown();artifact.server_close();gallery.server_close()
    return 0

if __name__=='__main__':raise SystemExit(main())
