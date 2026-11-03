// Vercel entry for the labelled preview. readConfig forces execution off when VERCEL
// is set, so this host cannot run uploaded or generated code.
import { createApp, readConfig } from '../src/webapp.js';

const app = createApp({ config: readConfig() });

export default function handler(req, res) {
  return app.handle(req, res);
}
