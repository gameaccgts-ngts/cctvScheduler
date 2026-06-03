# Child Life Calendar - Complete Web Server
# Serves both the calendar application AND videos from localhost:8080
# No CORS issues - everything is same-origin!

param(
    [int]$Port = 8080,
    [string]$VideoFolder = "videos"
)

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VideoPath = Join-Path $ScriptDir $VideoFolder

# Create videos folder if it doesn't exist
if (-not (Test-Path $VideoPath)) {
    New-Item -ItemType Directory -Path $VideoPath -Force | Out-Null
    Write-Host "Created videos folder at: $VideoPath"
}

Write-Host "======================================"
Write-Host "Child Life Calendar - Web Server"
Write-Host "======================================"
Write-Host "Starting server on port $Port"
Write-Host "Serving from: $ScriptDir"
Write-Host "Videos from: $VideoPath"
Write-Host ""
Write-Host "Open your calendar at: http://localhost:$Port/Child Life Calendar.html"
Write-Host ""
Write-Host "To stop the server, close this window or press Ctrl+C"
Write-Host "======================================"
Write-Host ""

# Create HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Server started successfully!"
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting for requests..."
Write-Host ""

try {
    while ($listener.IsListening) {
        # Wait for a request
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Get the requested path
        $requestedPath = $request.Url.LocalPath.TrimStart('/')
        
        # Handle root request - redirect to calendar
        if ($requestedPath -eq "" -or $requestedPath -eq "/") {
            $requestedPath = "Child Life Calendar.html"
        }

        # Handle /videos/ directory listing request
        if ($requestedPath -eq "videos" -or $requestedPath -eq "videos/") {
            # Return HTML listing of videos
            $videoFiles = Get-ChildItem -Path $VideoPath -File | Where-Object {
                $_.Extension -match '\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp)$'
            }
            
            $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Videos</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #2c3e50; color: white; }
        h1 { color: #76c2ef; }
        ul { list-style: none; padding: 0; }
        li { padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.1); border-radius: 5px; }
        a { color: #76c2ef; text-decoration: none; }
    </style>
</head>
<body>
    <h1>Available Videos</h1>
    <ul>
"@
            if ($videoFiles.Count -eq 0) {
                $html += "<li>No video files found</li>"
            } else {
                foreach ($file in $videoFiles) {
                    $fileSize = [math]::Round($file.Length / 1MB, 2)
                    $html += "<li><a href='/videos/$($file.Name)'>$($file.Name)</a> ($fileSize MB)</li>"
                }
            }
            $html += "</ul></body></html>"
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Served video directory listing" -ForegroundColor Green
            continue
        }

        # Determine the file path
        $filePath = Join-Path $ScriptDir $requestedPath
        
        # Check if file exists
        if (Test-Path $filePath -PathType Leaf) {
            # File exists - serve it
            $fileExtension = [System.IO.Path]::GetExtension($filePath).ToLower()
            
            # Determine content type
            $contentType = switch ($fileExtension) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".mp4"  { "video/mp4" }
                ".avi"  { "video/x-msvideo" }
                ".mov"  { "video/quicktime" }
                ".wmv"  { "video/x-ms-wmv" }
                ".flv"  { "video/x-flv" }
                ".webm" { "video/webm" }
                ".mkv"  { "video/x-matroska" }
                ".m4v"  { "video/x-m4v" }
                ".3gp"  { "video/3gpp" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }
            
            try {
                $fileSize = (Get-Item $filePath).Length
                $response.ContentType = $contentType
                $response.ContentLength64 = $fileSize
                $response.AddHeader("Accept-Ranges", "bytes")
                $response.AddHeader("Cache-Control", "no-cache")
                
                # Stream the file
                $fileStream = [System.IO.File]::OpenRead($filePath)
                $fileStream.CopyTo($response.OutputStream)
                $fileStream.Close()
                $response.OutputStream.Close()
                
                $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
                $logColor = if ($fileExtension -match '\.(mp4|avi|mov|wmv|webm|mkv)') { "Cyan" } else { "Green" }
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Served: $requestedPath ($fileSizeMB MB)" -ForegroundColor $logColor
            }
            catch {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR serving $requestedPath : $($_.Exception.Message)" -ForegroundColor Red
                $response.StatusCode = 500
                $response.Close()
            }
        }
        else {
            # File not found
            $response.StatusCode = 404
            $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>404 - Not Found</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 50px; 
            background: #2c3e50; 
            color: white; 
            text-align: center;
        }
        h1 { color: #e74c3c; }
        a { color: #76c2ef; }
    </style>
</head>
<body>
    <h1>404 - File Not Found</h1>
    <p>Could not find: $requestedPath</p>
    <p><a href="/Child Life Calendar.html">Go to Calendar</a></p>
</body>
</html>
"@
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.OutputStream.Close()
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] NOT FOUND: $requestedPath" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    $listener.Stop()
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Server stopped."
}
