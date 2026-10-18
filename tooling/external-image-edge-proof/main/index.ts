/** LOCAL TEST HARNESS ONLY. No credentials, project clients, business writes or deployment. */
declare const EdgeRuntime: {
  userWorkers: {
    create(options: Record<string, unknown>): Promise<{ fetch(req: Request): Promise<Response> }>;
  };
};
Deno.serve(async (req) => {
  if (new URL(req.url).pathname === '/ready') return new Response('ready');
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: '/workspace/tooling/external-image-edge-proof/function',
      maybeEszip: await Deno.readFile('/proof/function.eszip'),
      maybeEntrypoint: 'file:///workspace/tooling/external-image-edge-proof/function/index.ts',
      memoryLimitMb: 256,
      workerTimeoutMs: 150000,
      cpuTimeSoftLimitMs: 1900,
      cpuTimeHardLimitMs: 2000,
      noModuleCache: false,
      forceCreate: false,
      envVars: [],
    });
    return await worker.fetch(req);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
