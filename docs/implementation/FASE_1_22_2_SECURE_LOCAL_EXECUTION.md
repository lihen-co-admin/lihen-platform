# FASE 1.22.2 — Secure local DEV execution helper

## Purpose

`tooling/run-web-image-cutover-dev.ps1` wraps the existing canonical cutover script without changing its upload, hash, idempotency, Storage or RPC logic.

It exists only to make the Windows DEV execution safer and less error-prone.

## Security contract

- Supabase project is fixed to DEV ref `vnmkupzptujtywnnabkp`.
- The Service Role Key is never committed, written to a project file or echoed to the terminal.
- The key is requested as a PowerShell `SecureString`, converted only in process memory for the Node child process, then removed from the environment.
- `.env` is not required for this operation.
- Never paste the Service Role Key into chat, Git, screenshots or documentation.

## Execution contract

The helper:

1. Requires Node 24.x.
2. Runs the mandatory 952-row dry-run first.
3. Refuses execution unless the dry-run is `DRY_RUN_PASS` with 952 validated rows.
4. Prompts securely for the DEV Service Role Key.
5. Executes `tooling/cutover-web-images-v1.mjs --execute`.
6. Requires `EXECUTE_PASS`, 952 successful rows, zero failures and 952 canonical WEB_CARD metadata rows.
7. Removes the secret variables from the helper process on success or failure.

Run from repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-web-image-cutover-dev.ps1
```

Do not rerun after a failure until the generated execute report has been reviewed. The underlying cutover remains idempotent, but operational review is still mandatory.
