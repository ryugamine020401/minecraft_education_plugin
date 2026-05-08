$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "ChemistryPlus"
$behaviorPack = Join-Path $project "behavior_pack"
$resourcePack = Join-Path $project "resource_pack"

$bpZip = Join-Path $root "ChemistryPlus_BP.zip"
$rpZip = Join-Path $root "ChemistryPlus_RP.zip"
$bpPack = Join-Path $root "ChemistryPlus_BP.mcpack"
$rpPack = Join-Path $root "ChemistryPlus_RP.mcpack"
$addonZip = Join-Path $root "ChemistryPlus.zip"
$addon = Join-Path $root "ChemistryPlus.mcaddon"

if (!(Test-Path $behaviorPack)) {
  throw "Missing behavior pack folder: $behaviorPack"
}

if (!(Test-Path $resourcePack)) {
  throw "Missing resource pack folder: $resourcePack"
}

foreach ($path in @($bpZip, $rpZip, $bpPack, $rpPack, $addonZip, $addon)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Compress-Archive -Path (Join-Path $behaviorPack "*") -DestinationPath $bpZip -Force
Compress-Archive -Path (Join-Path $resourcePack "*") -DestinationPath $rpZip -Force

Move-Item -LiteralPath $bpZip -Destination $bpPack -Force
Move-Item -LiteralPath $rpZip -Destination $rpPack -Force

Compress-Archive -Path $bpPack, $rpPack -DestinationPath $addonZip -Force
Move-Item -LiteralPath $addonZip -Destination $addon -Force

Write-Host "Packaged:"
Write-Host " - $bpPack"
Write-Host " - $rpPack"
Write-Host " - $addon"
