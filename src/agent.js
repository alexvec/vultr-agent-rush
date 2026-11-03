import { SYSTEM_PROMPT } from './planners.js';

export const DEFAULT_AGENT_LIMITS = Object.freeze({
  maxSteps: 8,
  maxTokens: 20_000,
  deadlineMs: 180_000,
  toolResultChars: 8_000,
});

function clip(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max)}\n[truncated at ${max} characters]` : value;
}

/**
 * The agent loop. The planner decides each step, and the backend executes the tool
 * call through the sandbox and feeds back the result.
 */
export async function runAgent({ planner, sandbox, question, inputBytes, onEvent, limits = DEFAULT_AGENT_LIMITS }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];
  const executions = [];
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, reported_by_model_calls: 0 };
  const deadline = Date.now() + limits.deadlineMs;
  let modelRequests = 0;
  let answer = null;
  let endedBy = 'step_cap';

  for (let step = 1; step <= limits.maxSteps; step += 1) {
    if (Date.now() > deadline) { endedBy = 'deadline'; break; }
    if (usage.total_tokens >= limits.maxTokens) { endedBy = 'token_cap'; break; }

    onEvent({ type: 'planner_request', step, planner: planner.label, model: planner.model });
    modelRequests += 1;
    const decision = await planner.next(messages);
    if (decision.usage) {
      usage.prompt_tokens += decision.usage.prompt_tokens ?? 0;
      usage.completion_tokens += decision.usage.completion_tokens ?? 0;
      usage.total_tokens += decision.usage.total_tokens ?? 0;
      usage.reported_by_model_calls += 1;
    }
    messages.push(decision.assistantMessage);

    if (!decision.toolCalls.length) {
      answer = decision.content;
      endedBy = 'final_answer';
      onEvent({ type: 'final_answer', step, planner: planner.label, content: answer });
      break;
    }

    for (const call of decision.toolCalls) {
      let args;
      try {
        args = JSON.parse(call.arguments || '{}');
      } catch {
        args = null;
      }
      onEvent({ type: 'tool_call', step, planner: planner.label, tool: call.name, arguments: args ?? call.arguments });
      const content = await executeTool(call.name, args, { sandbox, inputBytes, executions, limits });
      onEvent({ type: 'tool_result', step, planner: planner.label, tool: call.name, content });
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }

  return { answer, endedBy, executions, usage, modelRequests, messages };
}

async function executeTool(name, args, { sandbox, inputBytes, executions, limits }) {
  if (args === null) return 'Tool error: arguments were not valid JSON.';
  if (name === 'read_input_file') {
    const requested = Number.isInteger(args.max_bytes) ? args.max_bytes : 8192;
    const size = Math.min(Math.max(requested, 1), 8192);
    return inputBytes.subarray(0, size).toString('utf8');
  }
  if (name === 'run_code') {
    if (typeof args.code !== 'string' || !args.code.trim()) return 'Tool error: code must be a non-empty string.';
    const result = await sandbox.run({ code: args.code, inputBytes });
    executions.push({ ...result, code: args.code });
    return clip(JSON.stringify({
      exit_reason: result.exit_reason,
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
    }), limits.toolResultChars);
  }
  return `Tool error: unknown tool ${String(name).slice(0, 60)}.`;
}
