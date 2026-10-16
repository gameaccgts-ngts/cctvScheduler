@echo off
REM Improved video server starter with better path handling

title Child Life Calendar - Video Server

echo ============================================
echo STARTING VIDEO SERVER
echo ============================================
echo.

cd /d "%~dp0"

echo Current folder: %CD%
echo.

if not exist "video-server.ps1" (
    echo ERROR: video-server.ps1 not found in this folder!
    echo.
    pause
    exit /b 1
)

echo Found video-server.ps1
echo.
echo Starting server now...
echo ============================================
echo.

REM Start PowerShell with the server script - this keeps the window open
powershell.exe -NoExit -ExecutionPolicy Bypass -Command "& '%~dp0video-server.ps1'"

REM If we get here, PowerShell closed
echo.
echo Server stopped or failed to start.
echo.
pause
