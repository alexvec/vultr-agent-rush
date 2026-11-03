import http from 'node:http';
import { createApp, readConfig } from './app.js';

const config = readConfig();
const app = createApp({ config });
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);

const server = http.createServer(app.handle);
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
app.startBackground();
server.listen(port, host, async () => {
  const health = await app.health();
  console.log(JSON.stringify({ event: 'listening', host, port, inference: health.inference, planner: health.planner, sandbox: health.sandbox.execution, host_label: health.host }));
});

const stop = () => {
  app.stopBackground();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
