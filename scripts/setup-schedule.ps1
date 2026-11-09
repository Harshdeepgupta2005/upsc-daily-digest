$ErrorActionPreference = "Stop"

$TaskName = "UPSC Digest Daily Research"
$Root = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $Root "scripts\daily-run.js"
$ConfigPath = Join-Path $Root "config.json"

if (-not (Test-Path $Script)) {
    throw "Could not find $Script"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js was not found on PATH. Install Node.js 20 or newer, then run this setup again."
}

$runAt = "06:00"
if (Test-Path $ConfigPath) {
    try {
        $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        if ($config.runAt) { $runAt = [string]$config.runAt }
    } catch {
        Write-Warning "Could not read config.json; using 06:00."
    }
}

$action = New-ScheduledTaskAction `
    -Execute $node.Source `
    -Argument ('"{0}"' -f $Script) `
    -WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -Daily -At $runAt

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Fetches, verifies and saves the daily UPSC current-affairs digest." `
    -Force | Out-Null

Write-Host ""
Write-Host "Daily research is scheduled for $runAt (system local time)." -ForegroundColor Green
Write-Host "Task name: $TaskName"
Write-Host "Data folder: $(Join-Path $Root 'data')"
Write-Host ""
Write-Host "Windows will catch up on a missed run the next time you log in."
