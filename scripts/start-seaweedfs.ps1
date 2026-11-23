# PowerShell script to launch SeaweedFS with S3 gateway
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$binPath = Join-Path $rootDir "seaweedfs\bin\weed.exe"
$dataPath = Join-Path $rootDir "seaweedfs\data"
$configPath = Join-Path $rootDir "seaweedfs\config\s3.json"

Write-Host "Starting SeaweedFS Server with S3 support..." -ForegroundColor Cyan
Write-Host "Binary: $binPath"
Write-Host "Data Dir: $dataPath"
Write-Host "S3 Config: $configPath"
Write-Host "S3 Endpoint: http://127.0.0.1:8333" -ForegroundColor Green

& $binPath server -dir="$dataPath" -s3=true -s3.config="$configPath" -master.port=9333 -volume.port=8080 -filer.port=8888 -s3.port=8333 -ip=127.0.0.1
