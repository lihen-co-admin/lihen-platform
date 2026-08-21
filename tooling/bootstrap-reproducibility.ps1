$ErrorActionPreference = 'Stop'

Write-Host 'LIHEN Platform - Fase 1.23/1.27 reproducibility bootstrap'

$nodeVersion = (& node --version).Trim()
if (-not ($nodeVersion -match '^v24\.')) {
  throw "Node 24.x is required. Current: $nodeVersion"
}

Write-Host "Node OK: $nodeVersion"

& corepack enable
& corepack prepare pnpm@10.15.0 --activate

$pnpmVersion = (& pnpm --version).Trim()
if ($pnpmVersion -ne '10.15.0') {
  throw "pnpm 10.15.0 is required. Current: $pnpmVersion"
}

Write-Host "pnpm OK: $pnpmVersion"

if (-not (Test-Path 'pnpm-lock.yaml')) {
  Write-Host 'Generating pnpm-lock.yaml with authoritative runtime...'
  & pnpm install --lockfile-only
}

if (-not (Test-Path 'pnpm-lock.yaml')) {
  throw 'pnpm-lock.yaml was not generated.'
}

Write-Host 'Verifying frozen installation...'
& pnpm install --frozen-lockfile

Write-Host 'Running project checks...'
& pnpm check

Write-Host 'Running image cutover dry-run under Node 24...'
& node tooling/cutover-web-images-v1.mjs

Write-Host ''
Write-Host 'PASS: Node 24 + pnpm 10.15.0 + frozen lockfile + project checks + image dry-run.'
Write-Host 'The repository is ready for the audited initial commit.'
