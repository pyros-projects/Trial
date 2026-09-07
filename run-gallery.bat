@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 gallery\server.py --open %*
) else (
  python gallery\server.py --open %*
)
