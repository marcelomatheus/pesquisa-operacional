@echo off
setlocal
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\dev.py
) else (
  python scripts\dev.py
)
exit /b %errorlevel%
