# FIRST OFFICIAL GITHUB COMMIT — LIHEN PLATFORM

Repositorio oficial:

`https://github.com/lihen-co-admin/lihen-platform`

## Precondición

No hacer el primer push antes de que `tooling/bootstrap-reproducibility.ps1` termine en PASS.

## Windows / VS Code

Abrir PowerShell en la raíz del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tooling\bootstrap-reproducibility.ps1
```

El script exige:

- Node 24.x;
- pnpm 10.15.0;
- `pnpm-lock.yaml`;
- instalación `--frozen-lockfile`;
- `pnpm check` PASS;
- dry-run 1.22.2 PASS con 952 archivos.

## Primer commit

Solo después del PASS:

```powershell
git init
git branch -M main
git remote add origin https://github.com/lihen-co-admin/lihen-platform.git
git add .
git status
git commit -m "chore: bootstrap audited LIHEN Platform Phase 1"
git push -u origin main
```

Si `origin` ya existe:

```powershell
git remote -v
```

y no volver a añadirlo.

## Seguridad antes del commit

Nunca incluir:

- `.env`
- `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY`
- passwords
- GitHub client secrets
- tokens

El `.gitignore` ya excluye `.env`, `.env.*` (excepto `.env.example`) y `*.local`.

## Después del primer push

Cambiar CI de:

```text
pnpm install --no-frozen-lockfile
```

a:

```text
pnpm install --frozen-lockfile
```

solo después de que `pnpm-lock.yaml` exista y haya sido validado.

## Regla futura

- `main`: estado estable/auditado.
- trabajo de desarrollo: branch `dev` o feature branches.
- no hacer cambios de esquema remoto sin una migración versionada.
