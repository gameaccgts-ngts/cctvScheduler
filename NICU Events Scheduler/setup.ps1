# Child Life Calendar - Setup Script
# Run this once on each computer to set up automatic video server startup

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CHILD LIFE CALENDAR - SETUP WIZARD" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerScriptPath = Join-Path $ScriptDir "video-server.ps1"
$VideoFolderPath = Join-Path $ScriptDir "videos"
$StartupFolderPath = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolderPath "ChildLifeCalendar-VideoServer.lnk"

Write-Host "Step 1: Checking files..." -ForegroundColor Yellow

# Verify the video server script exists
if (-not (Test-Path $ServerScriptPath)) {
    Write-Host "ERROR: video-server.ps1 not found!" -ForegroundColor Red
    Write-Host "Make sure this setup script is in the same folder as video-server.ps1" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "✓ Found video-server.ps1" -ForegroundColor Green

# Create videos folder if it doesn't exist
Write-Host ""
Write-Host "Step 2: Creating videos folder..." -ForegroundColor Yellow
if (-not (Test-Path $VideoFolderPath)) {
    New-Item -ItemType Directory -Path $VideoFolderPath -Force | Out-Null
    Write-Host "✓ Created videos folder at: $VideoFolderPath" -ForegroundColor Green
} else {
    Write-Host "✓ Videos folder already exists" -ForegroundColor Green
}

# Create startup shortcut
Write-Host ""
Write-Host "Step 3: Setting up automatic startup..." -ForegroundColor Yellow

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ServerScriptPath`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Child Life Calendar Video Server"
$Shortcut.IconLocation = "imageres.dll,77" # Video camera icon
$Shortcut.Save()

Write-Host "✓ Created startup shortcut" -ForegroundColor Green
Write-Host "  Server will start automatically when Windows starts" -ForegroundColor Gray

# Test if server can be started
Write-Host ""
Write-Host "Step 4: Testing video server..." -ForegroundColor Yellow

# Check if port 8080 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "⚠ Port 8080 is already in use" -ForegroundColor Yellow
    Write-Host "  The video server might already be running, or another program is using this port" -ForegroundColor Gray
} else {
    Write-Host "✓ Port 8080 is available" -ForegroundColor Green
}

# Create a helpful readme in the folder
$readmePath = Join-Path $ScriptDir "README-USAGE.txt"
$readmeContent = @"
CHILD LIFE CALENDAR - QUICK START GUIDE
========================================

SETUP COMPLETE! ✓

What was configured:
- Video server will start automatically when Windows starts
- Videos should be placed in the 'videos' folder
- Server runs on http://localhost:8080/


HOW TO USE:
-----------

1. ADD VIDEOS:
   - Copy your video files to the 'videos' folder
   - Supported formats: .mp4, .avi, .mov, .wmv, .webm, .mkv, etc.

2. OPEN THE CALENDAR:
   - Double-click 'Child Life Calendar.html'
   - Press ESC key to enter editor mode
   - Go to "Video Schedule" tab
   - Videos from your 'videos' folder will appear in the dropdowns

3. SCHEDULE VIDEOS:
   - Select a time and video for each day/timeslot
   - Click "SAVE VIDEOS"
   - Videos will play automatically at scheduled times

4. VIEW THE SERVER:
   - Open a web browser
   - Go to: http://localhost:8080/
   - You'll see a list of all available videos


TROUBLESHOOTING:
----------------

Problem: Videos don't appear in the calendar
Solution: 
  - Make sure the video server is running (see "Check Server Status" below)
  - Make sure videos are in the 'videos' folder
  - Restart the computer to start the server automatically

Problem: Videos won't play
Solution:
  - Open http://localhost:8080/ in your browser
  - Try clicking on a video - if it plays in browser, the server works
  - Check that the video file name matches what's in the schedule

Problem: Need to restart the server
Solution:
  - Press Ctrl+Alt+Delete
  - Open Task Manager
  - Find "Windows PowerShell" processes
  - End the one running video-server.ps1
  - Restart your computer (server will auto-start)


CHECK SERVER STATUS:
--------------------
To see if the server is running:
1. Open your web browser
2. Go to: http://localhost:8080/
3. If you see a list of videos, the server is running!


FOLDERS & FILES:
----------------
videos/                    - PUT YOUR VIDEO FILES HERE
Child Life Calendar.html   - OPEN THIS to use the calendar
video-server.ps1          - The video server (runs automatically)
setup.ps1                 - This setup script (only run once)


STUDIO COMPUTER INSTALLATION:
------------------------------
To install on the studio computer:
1. Copy this entire folder to the studio computer
2. Right-click 'setup.ps1' and choose 'Run with PowerShell'
3. Follow the prompts
4. Restart the computer
5. Done!


LOCATION OF AUTO-START:
------------------------
Startup shortcut created at:
$ShortcutPath


For help or questions, contact Scott.
"@

Set-Content -Path $readmePath -Value $readmeContent -Force
Write-Host "✓ Created README-USAGE.txt for reference" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What happens next:" -ForegroundColor White
Write-Host "  1. Add your video files to the 'videos' folder" -ForegroundColor Gray
Write-Host "  2. Restart this computer (or run video-server.ps1 manually now)" -ForegroundColor Gray
Write-Host "  3. Open 'Child Life Calendar.html' in your browser" -ForegroundColor Gray
Write-Host "  4. Press ESC to edit, go to Video Schedule tab" -ForegroundColor Gray
Write-Host "  5. Schedule your videos and click SAVE VIDEOS" -ForegroundColor Gray
Write-Host ""
Write-Host "The video server will start automatically every time Windows starts." -ForegroundColor Cyan
Write-Host ""
Write-Host "Do you want to start the video server now? (Y/N): " -ForegroundColor Yellow -NoNewline
$startNow = Read-Host

if ($startNow -eq "Y" -or $startNow -eq "y") {
    Write-Host ""
    Write-Host "Starting video server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$ServerScriptPath`""
    Write-Host "✓ Video server started in a new window!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Visit http://localhost:8080/ to see your videos" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Server will start automatically after you restart your computer." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
