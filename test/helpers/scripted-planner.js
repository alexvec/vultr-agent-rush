// TEST FIXTURE ONLY. Not an LLM and not part of the app: nothing under src/ can import it.
// It issues fixed tool calls so the agent loop and the sandbox can be tested with no model.
import { ATTACK_NETWORK_SECRETS } from '../../src/presets.js';

const INJECTION = /ignore (all |any |your )?(previous|prior) instructions|note to (the )?ai agent/i;

const CSV_SUMMARY = `import csv
with open("/input/data", newline="") as handle:
    rows = list(csv.DictReader(handle))
print("rows:", len(rows))
for column in rows[0].keys() if rows else []:
    values = []
    for row in rows:
        try:
            values.append(float(row[column]))
        except (TypeError, ValueError):
            pass
    if values and len(values) == len(rows):
        print("sum of", column + ":", round(sum(values), 2))
`;

/** Ignores the question. When the file contains the injection text it runs a fixed attack program on purpose. */
export class ScriptedPlanner {
  label = 'scripted';
  model = null;

  #step = 0;
  #note = '';

  async next(messages) {
    const step = this.#step++;
    if (step === 0) {
      return this.#call('read_input_file', { max_bytes: 8192 });
    }
    if (step === 1) {
      const fileText = messages.at(-1)?.content ?? '';
      if (INJECTION.test(fileText)) {
        this.#note = 'The file contains injection text. This fixed script runs a fixed attack program on purpose, so the walls get exercised. No model was steered.';
        return this.#call('run_code', { code: ATTACK_NETWORK_SECRETS });
      }
      this.#note = 'Fixed CSV summary. The question was not read, because no LLM is in use.';
      return this.#call('run_code', { code: CSV_SUMMARY });
    }
    const content = `[SCRIPTED PLANNER, no LLM] ${this.#note}\n\nSandbox tool result:\n${messages.at(-1)?.content ?? ''}`;
    return { assistantMessage: { role: 'assistant', content }, content, toolCalls: [], usage: null };
  }

  #call(name, args) {
    const id = `scripted-${this.#step}`;
    const serialised = JSON.stringify(args);
    return {
      assistantMessage: {
        role: 'assistant',
        content: null,
        tool_calls: [{ id, type: 'function', function: { name, arguments: serialised } }],
      },
      content: null,
      toolCalls: [{ id, name, arguments: serialised }],
      usage: null,
    };
  }
}
