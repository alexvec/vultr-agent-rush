// Run this first once a real key exists. It makes real calls to Vultr Serverless Inference:
// list models, one plain chat, one tool-call round trip. It prints facts and never prints the key.
import { InferenceClient, DEFAULT_BASE_URL, DEFAULT_MODEL } from '../src/inference.js';
import { TOOLS } from '../src/planners.js';

const apiKey = process.env.VULTR_INFERENCE_API_KEY;
if (!apiKey) {
  console.error('VULTR_INFERENCE_API_KEY is not set. Nothing was called.');
  process.exit(2);
}
const client = new InferenceClient({
  apiKey,
  baseUrl: process.env.VULTR_INFERENCE_BASE_URL || DEFAULT_BASE_URL,
  model: process.env.VULTR_INFERENCE_MODEL || DEFAULT_MODEL,
});
console.log('base URL:', client.baseUrl, 'model:', client.model);

const models = await client.listModels();
const ids = (models.data ?? models.models ?? []).map((m) => m.id ?? m.name);
console.log('1. /models returned:', ids.join(', ') || JSON.stringify(models).slice(0, 300));
if (ids.length && !ids.includes(client.model)) {
  console.error(`The model ${client.model} is not in the list. Set VULTR_INFERENCE_MODEL.`);
  process.exit(1);
}

const plain = await client.chat({ messages: [{ role: 'user', content: 'Reply with the single word: ready' }], maxTokens: 16 });
console.log('2. plain chat:', JSON.stringify(plain.message.content), 'usage:', JSON.stringify(plain.usage));
console.log('   fields the API returned:', JSON.stringify(plain.inference));

const messages = [
  { role: 'system', content: 'Use the run_code tool to compute answers.' },
  { role: 'user', content: 'Use run_code to print 6 * 7.' },
];
const first = await client.chat({ messages, tools: TOOLS, toolChoice: 'required', maxTokens: 256 });
const call = first.message.tool_calls?.[0];
if (!call) {
  console.error('3. FAILED: no tool call. Message:', JSON.stringify(first.message).slice(0, 500));
  process.exit(1);
}
console.log('3. tool call:', call.function.name, call.function.arguments);
messages.push(first.message, { role: 'tool', tool_call_id: call.id, content: JSON.stringify({ exit_reason: 'completed', exit_code: 0, stdout: '42\n', stderr: '' }) });
const second = await client.chat({ messages, tools: TOOLS, maxTokens: 128 });
console.log('4. after tool result:', JSON.stringify(second.message.content), 'usage:', JSON.stringify(second.usage));
console.log('Smoke test passed.');
