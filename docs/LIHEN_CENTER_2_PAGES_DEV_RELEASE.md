# LIHEN CENTER 2.0 - Pages DEV release

Target branch: github-pages-dev. Required parent: 3702ee47f89f86525b059465eb5a11e1b3157e9a.
The candidate is assembled with a temporary index; the internal worktree, branch and pending files remain intact. The candidate commit excludes internal snapshots, diagnostic artifacts, secrets, caches and the internal seven-commit ancestry. Exact changed paths: tooling/pages-dev/release-files.json. Public integration retains the existing local-lab intake instead of embedding private DEV snapshots; canonical authenticated readers, candidate review and human approval stay in place. No retrospective image provenance is asserted.

## Verified local result

- Types and integrated production build PASS. Prior functional/layout PASS results reused, not repeated.
- 15 focused Pages/workflow/recovery checks PASS; recovery repeated from the pinned ZIP and 116/116 hashes match. Existing Storefront is byte-identical to the recovered deployment.
- Local candidate output: dist/pages-dev-integration/pages-artifact-release. Binary manifests stay outside Git.
- New backup restore tooling rejects checksum mismatch, missing sites, traversal, duplicates and links; it fails rather than overwriting an output directory.
- Build-only has no deploy job, Pages setup or write permissions. Dispatch with deploy_dev=true explicitly authorizes the deploy job. No push trigger.
- Recovery restores both sites without recompiling; normal builds replace only Control Center and preserve Storefront from the pinned backup. CI validates resources and rejects known forbidden browser secrets/destinations before upload.
- Auth/RLS runtime and effective GitHub repository configuration remain untested here. No remote operations, data writes or AI calls were executed. No assurance of universal absence of sensitive content in inherited public history is made.

## Remote procedure - NOT EXECUTED

Requires explicit authorization, a legitimate GitHub session and GitHub CLI (or equivalent UI). The recovery ZIP is an already-published binary site backup, not a source/secret archive. Keep it outside Git. Publishing its recovery release is a separate remote operation; never overwrite an existing release asset.

```powershell
$backup = Join-Path $env:LOCALAPPDATA 'LIHEN/backups/DEV/3702ee47f89f86525b059465eb5a11e1b3157e9a/github-pages-12280570882.zip'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $backup).Hash.ToLowerInvariant() -ne '3c72ef792bc56cba30c210b4a0e0ef7d04ea4b258bd4c8934bfd361f7c84fb7c') { throw 'BACKUP_CHECKSUM_MISMATCH' }
gh release create pages-dev-rollback-3702ee4 $backup --repo lihen-co-admin/lihen-platform --target 3702ee47f89f86525b059465eb5a11e1b3157e9a --title 'Verified Pages DEV rollback 3702ee4' --notes 'Pinned binary recovery for Control Center and Storefront.' --prerelease --latest=false
if ($LASTEXITCODE -ne 0) { throw 'BACKUP_RELEASE_NOT_READY' }
$remote = (git ls-remote origin refs/heads/github-pages-dev).Split()[0]
if ($LASTEXITCODE -ne 0 -or $remote -ne '3702ee47f89f86525b059465eb5a11e1b3157e9a') { throw 'REMOTE_CHANGED_STOP' }
git push origin refs/lihen/pages-dev-candidate:refs/heads/github-pages-dev
if ($LASTEXITCODE -ne 0) { throw 'PUSH_FAILED_STOP' }
gh workflow run pages-dev.yml --repo lihen-co-admin/lihen-platform --ref github-pages-dev -f deploy_dev=false -f restore_backup=false
```

Review the resulting build-only run and artifact. Publishing is a distinct approved action; it performs a fresh build with the configured CI public DEV variables, not a promotion of identical bytes from the earlier run:

```powershell
gh workflow run pages-dev.yml --repo lihen-co-admin/lihen-platform --ref github-pages-dev -f deploy_dev=true -f restore_backup=false
```

## Recovery - same workflow, no rebuild

The fixed SHA-256 is 3c72ef792bc56cba30c210b4a0e0ef7d04ea4b258bd4c8934bfd361f7c84fb7c. The tool also records the inner artifact.tar hash separately. CI downloads only the named recovery asset and verifies this checksum; no arbitrary URL or checksum input is accepted. If the asset is absent, changed or inaccessible, CI stops before deployment.

Local restoration rehearsal (output must not exist):

```powershell
node tooling/pages-dev/restore-verified-backup.mjs $backup dist/pages-dev-recovery-review
node tooling/pages-dev/validate-pages-artifact.mjs dist/pages-dev-recovery-review
```

Build-only recovery rehearsal, then recovery deployment after approval:

```powershell
gh workflow run pages-dev.yml --repo lihen-co-admin/lihen-platform --ref github-pages-dev -f deploy_dev=false -f restore_backup=true
gh workflow run pages-dev.yml --repo lihen-co-admin/lihen-platform --ref github-pages-dev -f deploy_dev=true -f restore_backup=true
```

No reset, force push, remote Auth/RLS change or data restoration is involved. Remote download and Pages deployment are not certified by the local restoration test.

CLI reference: https://cli.github.com/manual/gh_release_create and https://cli.github.com/manual/gh_workflow_run.
