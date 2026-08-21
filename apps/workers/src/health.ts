export function workerHealth(): { status: 'ok'; service: 'lihen-workers' } {
  return { status: 'ok', service: 'lihen-workers' };
}

if (process.env.NODE_ENV !== 'test') {
  console.info(JSON.stringify(workerHealth()));
}
