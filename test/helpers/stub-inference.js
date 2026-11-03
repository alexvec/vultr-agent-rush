// A local stub of the documented Vultr inference API. This is not Vultr, so tests
// that use it show the client's behaviour, not how the real API responds.
import http from 'node:http';

/** `script` receives the parsed chat request and returns a choices[0].message. */
export async function startStub({ script, key = 'stub-key', models = [{ id: 'kimi-k2-instruct' }], bareResponses = false }) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => { raw += d; });
    req.on('end', () => {
      const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      };
      const body = raw ? JSON.parse(raw) : null;
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, contentType: req.headers['content-type'], body });
      if (req.headers.authorization !== `Bearer ${key}`) {
        send(401, { error: 'invalid key' });
      } else if (req.method === 'GET' && req.url === '/v1/models') {
        send(200, { data: models });
      } else if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        const message = script(body, requests);
        const choices = [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }];
        if (bareResponses) {
          send(200, { choices });
        } else {
          send(200, {
            id: `stub-response-${requests.length}`,
            model: body.model,
            choices,
            usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
          }, { 'x-request-id': `stub-request-${requests.length}` });
        }
      } else {
        send(404, { error: 'not found' });
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function toolCall(id, name, args) {
  return { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] };
}
