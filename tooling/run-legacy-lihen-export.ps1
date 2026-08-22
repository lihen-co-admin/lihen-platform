$ErrorActionPreference = 'Stop'

Write-Host 'LIHEN Phase 1.28 - Legacy Admin READ-ONLY Export' -ForegroundColor Cyan
Write-Host 'Source project: admhxolrhhipwcxbythl'
Write-Host ''

$nodeVersion = (& node --version).Trim()
if (-not $nodeVersion.StartsWith('v24.')) {
  throw "Node 24 is required. Current: $nodeVersion"
}
Write-Host "Node validated: $nodeVersion" -ForegroundColor Green

$email = Read-Host 'Legacy LIHEN Admin email'
$securePassword = Read-Host 'Legacy LIHEN Admin password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:LIHEN_LEGACY_ADMIN_EMAIL = $email
  $env:LIHEN_LEGACY_ADMIN_PASSWORD = $plainPassword
  node './tooling/export-legacy-lihen-admin.mjs'
  if ($LASTEXITCODE -ne 0) { throw "Exporter exited with code $LASTEXITCODE" }
}
finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Item Env:LIHEN_LEGACY_ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:LIHEN_LEGACY_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
  $securePassword = $null
}

Write-Host ''
Write-Host 'Credentials were removed from the process environment.' -ForegroundColor Green
Write-Host 'ZIP the generated legacy-export-* folder and attach it in ChatGPT. Do NOT commit it to Git.' -ForegroundColor Yellow
