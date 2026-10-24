@echo off
REM Stops the Game Hub server started by start.bat (whatever is listening on port 8765).
set found=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8765 .*LISTENING"') do (
  taskkill /pid %%p /f >nul 2>nul && set found=1
)
if defined found (echo Game Hub server stopped.) else (echo The Game Hub server was not running.)
