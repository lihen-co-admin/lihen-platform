LIHEN PLATFORM — FASE 2.1 AUTH/RLS GATE

1. Extract this ZIP over the root of lihen-platform, allowing folders to merge/replace.
2. Ensure these lines exist in .gitignore:
   legacy-export-*/
   legacy-export-*.zip
3. Use the authoritative runtime already established for the repo: Node 24.x + pnpm 10.15.0.
4. Run:
   pnpm install --frozen-lockfile
   pnpm check
   pnpm --filter @lihen/control-center dev
5. Open the local Control Center. Sign in with GitHub.
6. Open /dev-auth-probe and click "Ejecutar probe real".
7. Expected DEV evidence:
   - PASS
   - Profile: ACTIVE
   - Role: OWNER
   - Source Products: Supabase
   - Products read: 952
8. Send the PASS screen/result back to ChatGPT before Phase 2.1 is marked CLOSED.

Security: never paste an access token, secret key, password, or service-role key into chat.
