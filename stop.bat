@echo off
REM Stops the Controller Game Hub server started by start.bat, whichever kind it is
REM (Python, or the PowerShell fallback). Other programs on the port are left alone.
setlocal
cd /d "%~dp0"
if not defined HUB_PORT set HUB_PORT=8765
set stopped=

REM Python server: the process listening on the port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%HUB_PORT% .*LISTENING"') do call :stop_if_python %%p

REM PowerShell server: its port belongs to Windows itself, so it records its own PID
if exist ".server.pid" (
  set /p SPID=<".server.pid"
  call :stop_pid_if powershell
  del ".server.pid" >nul 2>nul
)

if defined stopped (echo Game Hub server stopped.) else (echo The Game Hub server was not running.)
exit /b 0

:stop_if_python
set SPID=%1
call :stop_pid_if python
call :stop_pid_if py
exit /b 0

:stop_pid_if
REM Only stop the PID if its program name starts with %1
tasklist /fi "pid eq %SPID%" /fi "imagename eq %1*" /nh 2>nul | findstr /c:" %SPID% " >nul
if errorlevel 1 exit /b 0
taskkill /pid %SPID% /f >nul 2>nul && set stopped=1
exit /b 0
