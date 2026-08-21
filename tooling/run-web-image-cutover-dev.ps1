[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedNodeMajor = 24
$ExpectedCount = 952
$SupabaseUrl = 'https://vnmkupzptujtywnnabkp.supabase.co'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DryRunReport = Join-Path $RepoRoot 'data/catalog-v1/web-image-storage-cutover-dry-run-report-v1.json'
$ExecuteReport = Join-Path $RepoRoot 'data/catalog-v1/web-image-storage-cutover-execute-report-v1.json'
$CutoverScript = Join-Path $RepoRoot 'tooling/cutover-web-images-v1.mjs'

Push-Location $RepoRoot
try {
    Write-Host 'LIHEN 1.22.2 - Web Image Storage DEV Cutover' -ForegroundColor Cyan
    Write-Host 'Proyecto Supabase DEV: vnmkupzptujtywnnabkp' -ForegroundColor DarkGray
    Write-Host ''

    $nodeVersion = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') {
        throw 'No se pudo verificar Node.js.'
    }
    $nodeMajor = [int]$Matches[1]
    if ($nodeMajor -ne $ExpectedNodeMajor) {
        throw "Se requiere Node 24.x para este cutover. Detectado: $nodeVersion"
    }
    Write-Host "Node validado: $nodeVersion" -ForegroundColor Green

    Write-Host 'Ejecutando dry-run obligatorio...' -ForegroundColor Yellow
    & node $CutoverScript
    if ($LASTEXITCODE -ne 0) {
        throw 'El dry-run fallo. No se ejecutara ningun upload.'
    }

    if (-not (Test-Path $DryRunReport)) {
        throw 'No se encontro el reporte del dry-run.'
    }
    $dryRun = Get-Content $DryRunReport -Raw | ConvertFrom-Json
    if ($dryRun.status -ne 'DRY_RUN_PASS' -or [int]$dryRun.validated_count -ne $ExpectedCount) {
        throw "Dry-run no valido. status=$($dryRun.status), validated_count=$($dryRun.validated_count)"
    }
    Write-Host "Dry-run PASS: $($dryRun.validated_count)/$ExpectedCount imagenes validadas." -ForegroundColor Green
    Write-Host ''

    Write-Host 'La Service Role Key NO se guardara en archivos ni se mostrara en pantalla.' -ForegroundColor Cyan
    $secureKey = Read-Host 'Pega la SUPABASE_SERVICE_ROLE_KEY del proyecto DEV y presiona Enter' -AsSecureString
    if ($secureKey.Length -eq 0) {
        throw 'No se ingreso SUPABASE_SERVICE_ROLE_KEY.'
    }

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
        $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        if ([string]::IsNullOrWhiteSpace($plainKey)) {
            throw 'La SUPABASE_SERVICE_ROLE_KEY esta vacia.'
        }

        $env:SUPABASE_URL = $SupabaseUrl
        $env:SUPABASE_SERVICE_ROLE_KEY = $plainKey
        $env:LIHEN_CUTOVER_CONCURRENCY = '1'
        $env:LIHEN_CUTOVER_MAX_ATTEMPTS = '10'
        $env:LIHEN_CUTOVER_BACKOFF_MS = '1000'
        $plainKey = $null

        Write-Host ''
        Write-Host 'Ejecutando cutover real en Supabase DEV...' -ForegroundColor Yellow
        & node $CutoverScript --execute
        $executeExit = $LASTEXITCODE
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
        Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
        Remove-Item Env:LIHEN_CUTOVER_CONCURRENCY -ErrorAction SilentlyContinue
        Remove-Item Env:LIHEN_CUTOVER_MAX_ATTEMPTS -ErrorAction SilentlyContinue
        Remove-Item Env:LIHEN_CUTOVER_BACKOFF_MS -ErrorAction SilentlyContinue
    }

    if ($executeExit -ne 0) {
        throw 'El cutover termino con error. No lo vuelvas a ejecutar hasta revisar el reporte generado.'
    }

    if (-not (Test-Path $ExecuteReport)) {
        throw 'No se encontro el reporte de ejecucion.'
    }
    $executeReportData = Get-Content $ExecuteReport -Raw | ConvertFrom-Json
    if ($executeReportData.status -ne 'EXECUTE_PASS') {
        throw "El reporte no termino en EXECUTE_PASS. Estado: $($executeReportData.status)"
    }
    if ([int]$executeReportData.successful_count -ne $ExpectedCount -or [int]$executeReportData.failed_count -ne 0) {
        throw "Conteos inesperados. successful=$($executeReportData.successful_count), failed=$($executeReportData.failed_count)"
    }
    if ([int]$executeReportData.canonical_web_card_metadata_count -ne $ExpectedCount) {
        throw "Metadata canonica incompleta: $($executeReportData.canonical_web_card_metadata_count)/$ExpectedCount"
    }

    Write-Host ''
    Write-Host '==============================================' -ForegroundColor Green
    Write-Host '1.22.2 LOCAL EXECUTION GATE: EXECUTE_PASS' -ForegroundColor Green
    Write-Host "Imagenes exitosas: $($executeReportData.successful_count)/$ExpectedCount" -ForegroundColor Green
    Write-Host "Fallos: $($executeReportData.failed_count)" -ForegroundColor Green
    Write-Host "Metadata WEB_CARD activa: $($executeReportData.canonical_web_card_metadata_count)/$ExpectedCount" -ForegroundColor Green
    Write-Host 'La Service Role Key fue retirada del entorno del script.' -ForegroundColor Green
    Write-Host '==============================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Conserva esta terminal y comparte solamente el reporte/salida, nunca la clave.' -ForegroundColor Cyan
}
finally {
    Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:LIHEN_CUTOVER_CONCURRENCY -ErrorAction SilentlyContinue
    Remove-Item Env:LIHEN_CUTOVER_MAX_ATTEMPTS -ErrorAction SilentlyContinue
    Remove-Item Env:LIHEN_CUTOVER_BACKOFF_MS -ErrorAction SilentlyContinue
    Pop-Location
}
