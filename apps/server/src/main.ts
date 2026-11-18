import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';
import { storeFromEnv } from './store';

const here = path.dirname(fileURLToPath(import.meta.url));

const store = await storeFromEnv();
const server = await startServer({
  port: Number(process.env.PORT ?? 3001),
  store,
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 900),
  clientDist: process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist'),
  corsOrigins: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
});
console.log(`[island] Server listening on ${server.url} (store: ${store.kind})`);

const stop = async () => {
  console.log('[island] Shutting down…');
  await server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
