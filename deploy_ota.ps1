#!/usr/bin/env powershell
<#
.SYNOPSIS
	Deploy OTA updates for Quantum TV app via EAS

.EXAMPLE
	.\deploy_ota.ps1 -Message "fix: video playback issues"
#>

param(
	[Parameter(Mandatory=$false)]
	[string]$Message = "Update from $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$easCli = "eas"
$mobileDir = "C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile"

try {
	# Change to mobile directory
	Push-Location $mobileDir
	Write-Host "📱 Quantum TV - OTA Update Deployment" -ForegroundColor Cyan
	Write-Host "=====================================" -ForegroundColor Cyan

	# Check if EAS is installed
	Write-Host "`n🔍 Checking EAS CLI..." -ForegroundColor Yellow
	$easVersion = & $easCli --version 2>$null
	if (-not $easVersion) {
		Write-Host "❌ EAS CLI not found. Install it first:" -ForegroundColor Red
		Write-Host "   npm install -g eas-cli" -ForegroundColor White
		exit 1
	}
	Write-Host "✅ EAS CLI $easVersion installed" -ForegroundColor Green

	# Check authentication
	Write-Host "`n🔐 Checking authentication..." -ForegroundColor Yellow
	& $easCli whoami >$null 2>&1
	if ($LASTEXITCODE -ne 0) {
		Write-Host "❌ Not authenticated. Run: eas login" -ForegroundColor Red
		exit 1
	}
	Write-Host "✅ Authenticated" -ForegroundColor Green

	# Check current version in app.json
	Write-Host "`n📋 Current version in app.json:" -ForegroundColor Yellow
	$appJson = Get-Content app.json | ConvertFrom-Json
	$currentVersion = $appJson.expo.version
	Write-Host "   v$currentVersion" -ForegroundColor White

	# Prompt to increment version
	Write-Host "`n🔄 Would you like to increment the patch version?" -ForegroundColor Cyan
	Write-Host "   Current: $currentVersion" -ForegroundColor White
	$response = Read-Host "   Increment patch version? (y/n)"

	if ($response -eq 'y' -or $response -eq 'Y') {
		# Parse and increment version
		$versionParts = $currentVersion -split '\.'
		[int]$major = $versionParts[0]
		[int]$minor = $versionParts[1]
		[int]$patch = $versionParts[2]

		$patch++
		$newVersion = "$major.$minor.$patch"

		Write-Host "   New version: $newVersion" -ForegroundColor Green

		# Update app.json
		$appJson.expo.version = $newVersion
		$appJson | ConvertTo-Json -Depth 10 | Set-Content app.json
		Write-Host "   ✅ Updated app.json" -ForegroundColor Green

		# Update versionCode for Android
		if ($null -ne $appJson.expo.android.versionCode) {
			$appJson.expo.android.versionCode += 1
			$appJson | ConvertTo-Json -Depth 10 | Set-Content app.json
			Write-Host "   ✅ Incremented Android versionCode to $($appJson.expo.android.versionCode)" -ForegroundColor Green
		}
	}

	# Deploy OTA update
	Write-Host "`n🚀 Deploying OTA update..." -ForegroundColor Cyan
	Write-Host "   Platform: Android" -ForegroundColor White
	Write-Host "   Message: $Message" -ForegroundColor White
	Write-Host ""

	& $easCli update --platform android --message $Message

	if ($LASTEXITCODE -eq 0) {
		Write-Host "`n✅ OTA Update deployed successfully!" -ForegroundColor Green
		Write-Host "   Users will get the update on next app launch or manual refresh" -ForegroundColor Green
		Write-Host "`n📊 Check update status:" -ForegroundColor Cyan
		Write-Host "   eas update:list" -ForegroundColor White
	} else {
		Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
		exit 1
	}

} catch {
	Write-Host "❌ Error: $_" -ForegroundColor Red
	exit 1
} finally {
	Pop-Location
}
