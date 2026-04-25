/**
 * NEXT.JS INSTRUMENTATION
 * Runs on server startup. Used to initialize background workers and shared resources.
 */

export async function register() {
  console.log('[Instrumentation] Bootstrapping. NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    const { initWorkers } = await import('./lib/services/worker-registry');
    initWorkers();
  }
}
