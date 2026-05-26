@echo off
setlocal
set "ROOT=%~dp0"
echo [test] Starting jarvis-rotate.bat...
echo.
call "%ROOT%jarvis-rotate.bat"
echo.
echo [test] EXIT CODE: %errorlevel%
echo [test] Press any key...
pause > nul
endlocal
