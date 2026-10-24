@echo off
REM Starts the Controller Game Hub and opens it in the browser.
REM
REM   1. If the hub is already running, just opens it.
REM   2. Otherwise looks for Python (py launcher, python, python3) and runs its
REM      built-in web server. No extra Python packages are needed.
REM   3. No Python? Installs it once with winget (Windows' package manager).
REM   4. Still none? Falls back to scripts\serve.ps1, which needs only the
REM      PowerShell that ships with Windows.
REM
REM Browsers only expose game controllers to pages served over http, which is
REM why the hub needs a local server at all. Optional: set HUB_PORT to use
REM another port, HUB_NO_BROWSER=1 to skip opening the browser.
setlocal
cd /d "%~dp0"
if not defined HUB_PORT set HUB_PORT=8765
set "URL=http://localhost:%HUB_PORT%/"

call :listening
if not errorlevel 1 (
  call :is_hub
  if not errorlevel 1 (
    echo The Game Hub is already running.
    goto open
  )
  echo Port %HUB_PORT% is already used by another program.
  echo Close that program, or run:  set HUB_PORT=8766 ^& start.bat
  pause
  exit /b 1
)

call :find_python
if not defined PY (
  echo Python was not found.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo Installing Python with winget. This happens only once...
    winget install --exact --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
    call :find_python
  ) else (
    echo winget is not available, so Python can't be installed automatically.
  )
)

if defined PY (
  echo Starting the server with Python: %PY%
  start "Game Hub server" /min %PY% -m http.server %HUB_PORT% --bind 127.0.0.1
) else (
  echo Starting the built-in PowerShell server instead.
  start "Game Hub server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1" -Port %HUB_PORT%
)

REM Wait until the server answers (up to about 15 seconds)
set tries=0
:wait
call :is_hub
if not errorlevel 1 goto open
set /a tries+=1
if %tries% geq 15 (
  echo The server did not start. Look at the minimized "Game Hub server" window for the error.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:open
echo Game Hub: %URL%
if not "%HUB_NO_BROWSER%"=="1" start "" "%URL%"
exit /b 0

REM ---------- helpers ----------
:listening
netstat -ano | findstr /r /c:":%HUB_PORT% .*LISTENING" >nul
exit /b %errorlevel%

:is_hub
REM The hub serves games.js with the game list; anything else on the port isn't ours
curl.exe -s -m 2 "%URL%games.js" 2>nul | findstr /c:"window.GAMES" >nul
exit /b %errorlevel%

:find_python
REM "python" can be a Microsoft Store shortcut that isn't really Python,
REM so each candidate must actually run.
set PY=
for %%c in ("py -3" "python" "python3") do (
  if not defined PY (
    %%~c -c "import http.server" >nul 2>nul && set "PY=%%~c"
  )
)
REM Right after a winget install this window's PATH is stale; check the install folder
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PY="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
exit /b 0
