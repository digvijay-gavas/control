@echo off
REM Starts the local server for the Controller Game Hub and opens it in the browser.
REM Browsers only expose game controllers to pages served over http, so the hub needs this.
cd /d "%~dp0"
where python >nul 2>nul || (echo Python was not found. Install it from https://www.python.org/ and try again. & pause & exit /b 1)
netstat -ano | findstr /r /c:":8765 .*LISTENING" >nul
if errorlevel 1 (
  start "Game Hub server" /min python -m http.server 8765 --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
) else (
  echo The Game Hub server is already running.
)
start "" http://localhost:8765/
