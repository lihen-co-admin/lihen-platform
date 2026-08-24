const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing Storefront release environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
const url = process.env.VITE_SUPABASE_URL.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  console.error('VITE_SUPABASE_URL must be an https://*.supabase.co URL.');
  process.exit(1);
}
if (/service[_-]?role/i.test(key)) {
  console.error('A service-role key must never be exposed to the Storefront.');
  process.exit(1);
}
if (!/^sb_publishable_/i.test(key)) {
  console.error('VITE_SUPABASE_PUBLISHABLE_KEY must use a browser-publishable key.');
  process.exit(1);
}
console.log('Storefront release environment contract: PASS');
