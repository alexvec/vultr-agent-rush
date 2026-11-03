import http from 'node:http';
import { createApp, readConfig } from './webapp.js';

const config = readConfig();
const app = createApp({ config });
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);

const server = http.createServer(app.handle);
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
app.startBackground();
await app.canary?.start();
server.listen(port, host, async () => {
  const health = await app.health();
  console.log(JSON.stringify({ event: 'listening', host, port, inference: health.inference, planner: health.planner, sandbox: health.sandbox.execution, deployment: health.deployment, host_label: health.host, track: health.track.status, canary_listening: health.canary.listening }));
});

const stop = () => {
  app.stopBackground();
  app.canary?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
