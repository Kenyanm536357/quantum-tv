param(
	[string]$serial = 'adb-2A051HFGN37GFA-tvNhJ1._adb-tls-connect._tcp',
	[string]$apkPath = '',
	[string]$username = 'TestAccount12',
	[string]$password = '1143435535'
)

$adb = "C:\\Users\\kenya\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\\platform-tools\\adb.exe"
if (-not (Test-Path $adb)) { Write-Error "adb not found at $adb"; exit 1 }

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$outDir = Join-Path $PSScriptRoot "results_$timestamp"
New-Item -Path $outDir -ItemType Directory | Out-Null

function Run($cmd) { Write-Output "> $cmd"; cmd /c $cmd }

# ensure device online
& $adb devices -l | Out-File -FilePath (Join-Path $outDir 'devices.txt') -Encoding utf8

Write-Output "Using serial: $serial"

if ($apkPath -ne '') {
	Write-Output "Installing APK: $apkPath"
	& $adb -s $serial install -r "$apkPath" | Tee-Object -FilePath (Join-Path $outDir 'install.txt')
}

# start app
Write-Output "Starting app main activity"
& $adb -s $serial shell am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -n com.quantumtv.app/.MainActivity
Start-Sleep -Seconds 3

# take initial screenshot
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_initial.png')

# Attempt login: try to send username/password (best-effort)
Write-Output "Attempting login (best-effort): $username"
# Tap center to focus
& $adb -s $serial shell input keyevent 23
Start-Sleep -Milliseconds 500
# send username
& $adb -s $serial shell input text "$username"
Start-Sleep -Milliseconds 500
# press TAB / DPAD_RIGHT then input password
& $adb -s $serial shell input keyevent 22
Start-Sleep -Milliseconds 300
& $adb -s $serial shell input text "$password"
Start-Sleep -Milliseconds 300
# press Enter
& $adb -s $serial shell input keyevent 66
Start-Sleep -Seconds 3

# capture after login
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_after_login.png')

# Navigate to Live section - heuristic: press DPAD down/up and select
Write-Output "Navigating to Live section"
& $adb -s $serial shell input keyevent 20
Start-Sleep -Milliseconds 500
& $adb -s $serial shell input keyevent 20
Start-Sleep -Milliseconds 500
& $adb -s $serial shell input keyevent 23
Start-Sleep -Seconds 2
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_live.png')

# Try to start playback (press center)
Write-Output "Attempting playback"
& $adb -s $serial shell input keyevent 23
Start-Sleep -Seconds 5
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_playback.png')

# Favorites: try to open menu / press menu key (if available) and toggle favorite
Write-Output "Attempting favorites toggle (DPAD_CENTER then menu)"
& $adb -s $serial shell input keyevent 82
Start-Sleep -Seconds 1
& $adb -s $serial shell input keyevent 23
Start-Sleep -Seconds 2
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_favorite.png')

# Recent: go back and then open Recent (heuristic)
& $adb -s $serial shell input keyevent 4
Start-Sleep -Seconds 1
& $adb -s $serial shell input keyevent 66
Start-Sleep -Seconds 2
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_recent.png')

# Settings: open settings via menu or navigate to settings
Write-Output "Attempting to open Settings (DPAD navigation)"
for ($i=0; $i -lt 6; $i++) { & $adb -s $serial shell input keyevent 21; Start-Sleep -Milliseconds 300 }
& $adb -s $serial shell input keyevent 23
Start-Sleep -Seconds 2
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_settings.png')

# Search: attempt to open search via keyevent (if available)
Write-Output "Attempting Search (DPAD + center)"
& $adb -s $serial shell input keyevent 84
Start-Sleep -Seconds 2
& $adb -s $serial exec-out screencap -p > (Join-Path $outDir 'screen_search.png')

# Collect logcat
$logFile = Join-Path $outDir 'logcat.txt'
& $adb -s $serial logcat -d > $logFile

Write-Output "Test complete. Results saved to: $outDir"
Write-Output "Files:"
Get-ChildItem -Path $outDir | Select-Object Name, Length | Format-Table -AutoSize

exit 0
