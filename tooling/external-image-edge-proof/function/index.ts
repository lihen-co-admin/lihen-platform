/** LOCAL synthetic acceptance endpoint. Not wired into intelligence-runtime or deploy config. */
import { convertExternalPng } from '../../../supabase/functions/intelligence-runtime/external-image-conversion.ts';
Deno.serve(async (req) => {
  try {
    const before = performance.now();
    const result = await convertExternalPng(new Uint8Array(await req.arrayBuffer()));
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(result.bytes).buffer)),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    return Response.json({
      status: 'PASS',
      width: result.width,
      height: result.height,
      bytes: result.bytes.length,
      webp: String.fromCharCode(...result.bytes.slice(8, 12)),
      sha256,
      elapsedMs: performance.now() - before,
      workerApi: typeof Worker,
      memory: Deno.memoryUsage(),
    });
  } catch (error) {
    return Response.json({ error: String(error), workerApi: typeof Worker }, { status: 422 });
  }
});
