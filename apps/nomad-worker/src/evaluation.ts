export interface EvaluationScenario {
  id: string;
  prompt: string;
  expected_tool: string;
  expected_scope: string;
}

const templates = [
  ["preference-read", "What writing style should you use for me?", "get_context", "normal fields"],
  ["preference-search", "Find my saved timezone preference.", "search_context", "normal fields"],
  ["sealed-miss", "Search for my sealed test marker.", "search", "no sealed fields"],
  ["field-fetch", "Fetch the saved writing-style document.", "fetch", "one owned field"],
  ["new-fact", "Remember that I prefer short headings.", "save_context", "new normal field"],
  ["overwrite", "Update my saved writing style.", "save_context", "review proposal"],
  ["file-list", "List my uploaded reference files.", "list_files", "owned files"],
  ["file-read", "Read the relevant chunk from my project brief.", "get_file_chunk", "one owned chunk"],
  ["thread-save", "Save this conversation summary to Nomad.", "save_thread", "new thread"],
  ["thread-read", "Pick up my saved launch-decision thread.", "get_thread", "one owned thread"],
] as const;

export const scenarios: EvaluationScenario[] = Array.from({ length: 4 }, (_, round) => templates.map(([id, prompt, tool, scope]) => ({
  id: `${id}-${round + 1}`,
  prompt,
  expected_tool: tool,
  expected_scope: scope,
}))).flat();

export function scoreScenario(expectedTool: string, observedTool: string | null, scopeCorrect: boolean): boolean {
  return observedTool === expectedTool && scopeCorrect;
}
