#!/usr/bin/env python3
"""Import one independently evaluated artifact without executing submitted code."""
from __future__ import annotations
import argparse
import json
import math
import os
import re
import shutil
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'gallery'))
from projects import source_files,validate_preview_url


def safe_segment(value: str) -> str:
    segment=re.sub(r'[^A-Za-z0-9._-]+','_',value.strip()).strip('._')
    if not segment:raise argparse.ArgumentTypeError(f'Invalid folder name: {value!r}')
    return segment


def readable_file(value: str) -> Path:
    path=Path(value).expanduser()
    if path.is_symlink() or not path.is_file():raise argparse.ArgumentTypeError(f'Not a regular file: {value}')
    return path.resolve()


def readable_project(value: str) -> Path:
    path=Path(value).expanduser()
    if path.is_symlink():raise argparse.ArgumentTypeError('Project root cannot be a symlink.')
    try:
        if path.is_dir():source_files(path)
        elif not path.is_file() or path.suffix.lower()!='.zip' or not zipfile.is_zipfile(path):
            raise ValueError('Expected a source directory or a valid ZIP.')
    except (OSError,ValueError) as error:raise argparse.ArgumentTypeError(str(error)) from error
    return path.resolve()


def local_url(value: str) -> str:
    try:return validate_preview_url(value)
    except ValueError as error:raise argparse.ArgumentTypeError(str(error)) from error


def parser() -> argparse.ArgumentParser:
    catalog=json.loads((ROOT/'prompts/catalog.json').read_text(encoding='utf-8'))
    p=argparse.ArgumentParser(description='Create/import one agentic benchmark run. Never install, extract or launch submitted code.')
    p.add_argument('--model',required=True);p.add_argument('--run',required=True)
    p.add_argument('--task',required=True,choices=[t['id'] for t in catalog])
    p.add_argument('--results-dir',type=Path,default=ROOT/'results')
    p.add_argument('--model-folder',type=safe_segment);p.add_argument('--run-folder',type=safe_segment)
    p.add_argument('--provider');p.add_argument('--model-version');p.add_argument('--score',type=float)
    p.add_argument('--tag',action='append',default=[]);p.add_argument('--notes')
    artifacts=p.add_mutually_exclusive_group()
    artifacts.add_argument('--html',type=readable_file,help='Standalone HTML copied to index.html.')
    artifacts.add_argument('--project',type=readable_project,help='Source directory or ZIP, copied as project/ or project.zip.')
    p.add_argument('--url',type=local_url,help='Optional manually started local project preview URL.')
    p.add_argument('--screenshot',type=readable_file)
    p.add_argument('--report',type=readable_file,help='Evaluator-owned JSON report, not agent self-assessment.')
    p.add_argument('--force',action='store_true',help='Explicitly update existing run; replacing source clears stale score/report/screenshots.')
    return p


def remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():path.unlink()
    elif path.is_dir():shutil.rmtree(path)


def copy_project(source: Path,target: Path) -> None:
    if source.is_file():shutil.copy2(source,target.with_suffix('.zip'));return
    target.mkdir()
    for path in source_files(source):
        dest=target/path.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dest)


def main() -> int:
    args=parser().parse_args()
    try:
        if args.score is not None and (not math.isfinite(args.score) or not 0<=args.score<=100):
            raise ValueError('--score must be finite and between 0 and 100.')
        root=args.results_dir.expanduser().resolve()
        destination=root/(args.model_folder or safe_segment(args.model))/(args.run_folder or safe_segment(args.run))
        if destination.is_symlink() or destination.parent.is_symlink():raise ValueError('Refusing symlinked run/model folders.')
        if destination.exists() and (not destination.is_dir() or (any(destination.iterdir()) and not args.force)):
            raise ValueError(f'Run already exists: {destination}. Choose another run or explicitly use --force.')
        if args.project and args.project.is_dir() and (args.project==destination or args.project in destination.parents):
            raise ValueError('Destination cannot be inside the source project.')
        if args.url and (args.html or not (args.project or (destination/'project').is_dir() or (destination/'project.zip').is_file())):
            raise ValueError('--url requires a source project/archive, not an HTML-only run.')
        if args.screenshot and args.screenshot.suffix.lower() not in {'.png','.webp','.jpg','.jpeg'}:
            raise ValueError('Screenshot must be PNG, WebP, JPG or JPEG.')
        if args.report and not isinstance(json.loads(args.report.read_text(encoding='utf-8')),dict):
            raise ValueError('Report must be a JSON object.')
        metadata_path=destination/'metadata.json'
        if metadata_path.is_symlink():raise ValueError('Existing metadata must not be a symlink.')
        meta=json.loads(metadata_path.read_text(encoding='utf-8')) if metadata_path.is_file() else {}
        if not isinstance(meta,dict):raise ValueError('Existing metadata must be a JSON object.')
        if meta.get('task_id') not in {None,args.task}:raise ValueError('An existing run cannot be reassigned to another task.')
        replacing=bool(args.html or args.project)
        if replacing:
            for key in ('score','preview_url'):meta.pop(key,None)
        task=next(t for t in json.loads((ROOT/'prompts/catalog.json').read_text(encoding='utf-8')) if t['id']==args.task)
        meta.update(task_id=args.task,model=args.model,run_id=args.run,track=task['track'],rubric=task['rubric'])
        now=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
        meta.setdefault('created_at',now);meta['updated_at']=now
        previous_tags=meta.get('tags',[])
        if not isinstance(previous_tags,list):previous_tags=[]
        meta['tags']=list(dict.fromkeys([str(t) for t in previous_tags]+args.tag))
        if args.notes is not None:meta['notes']=args.notes
        if args.provider:meta['provider']=args.provider
        if args.model_version:meta['model_version']=args.model_version
        if args.score is not None:meta['score']=args.score
        if args.url:meta['preview_url']=args.url
        destination.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.import-',dir=destination.parent) as temp:
            candidate=Path(temp)/'run'
            if destination.is_dir():shutil.copytree(destination,candidate,symlinks=True)
            else:candidate.mkdir()
            if replacing:
                for name in ('index.html','result.html','app.html','project','project.zip','report.json','evidence'):
                    remove(candidate/name)
                for stem in ('screenshot','preview'):
                    for ext in ('.png','.webp','.jpg','.jpeg'):remove(candidate/(stem+ext))
            if args.html:shutil.copy2(args.html,candidate/'index.html')
            elif args.project:copy_project(args.project,candidate/'project')
            if args.screenshot:
                for stem in ('screenshot','preview'):
                    for ext in ('.png','.webp','.jpg','.jpeg'):remove(candidate/(stem+ext))
                shutil.copy2(args.screenshot,candidate/('screenshot'+args.screenshot.suffix.lower()))
            if args.report:
                remove(candidate/'report.json');shutil.copy2(args.report,candidate/'report.json')
            remove(candidate/'metadata.json')
            (candidate/'metadata.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
            backup=destination.with_name('.backup-'+uuid.uuid4().hex)
            existed=destination.exists()
            if existed:os.replace(destination,backup)
            try:os.replace(candidate,destination)
            except OSError:
                if existed:os.replace(backup,destination)
                raise
            if existed:shutil.rmtree(backup)
        print(destination);return 0
    except (OSError,ValueError,KeyError,TypeError) as error:
        print(f'Import failed: {error}',file=sys.stderr);return 1

if __name__=='__main__':raise SystemExit(main())
