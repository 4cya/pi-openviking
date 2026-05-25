import type { Component } from "@earendil-works/pi-tui";
import { Text } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";

// --- memsearch renderers ---

export function renderMemsearchCall(
  args: { query: string; mode?: string; limit?: number },
  theme: Theme,
): Component {
  let text = theme.fg("toolTitle", theme.bold("memsearch "));
  text += theme.fg("accent", `"${args.query}"`);
  text += theme.fg("dim", ` ${args.mode ?? "auto"}`);
  return new Text(text, 0, 0);
}

export function renderMemsearchResult(
  result: { content: Array<{ type: string; text: string }>; details: Record<string, unknown> },
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const content = result.content[0];
  if (!content || content.type !== "text") {
    return new Text(theme.fg("error", "No results"), 0, 0);
  }

  let parsed: { total?: number } = {};
  try {
    parsed = JSON.parse(content.text);
  } catch {
    return new Text(theme.fg("error", "Parse error"), 0, 0);
  }

  const total = parsed.total ?? 0;
  let text = theme.fg("success", `${total} results`);

  if (options.expanded) {
    text += "\n" + theme.fg("dim", content.text);
  }

  return new Text(text, 0, 0);
}

// --- memread renderers ---

export function renderMemreadCall(
  args: { uri: string; level?: string },
  theme: Theme,
): Component {
  let text = theme.fg("toolTitle", theme.bold("memread "));
  text += theme.fg("accent", args.uri);
  text += theme.fg("dim", ` ${args.level ?? "auto"}`);
  return new Text(text, 0, 0);
}

export function renderMemreadResult(
  result: { content: Array<{ type: string; text: string }>; details: Record<string, unknown> },
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const content = result.content[0];
  if (!content || content.type !== "text") {
    return new Text(theme.fg("error", "No content"), 0, 0);
  }

  const lineCount = content.text.split("\n").length;
  let text = theme.fg("success", `${lineCount} lines`);

  if (options.expanded) {
    const lines = content.text.split("\n").slice(0, 20);
    for (const line of lines) {
      text += `\n${theme.fg("dim", line)}`;
    }
    if (lineCount > 20) {
      text += `\n${theme.fg("muted", `... ${lineCount - 20} more lines`)}`;
    }
  }

  return new Text(text, 0, 0);
}

// --- generic renderers (membrowse, memcommit, memdelete, memimport) ---

export function renderGenericCall(
  toolName: string,
  args: Record<string, unknown>,
  theme: Theme,
): Component {
  const keyArg = Object.values(args).find((v) => typeof v === "string") ?? "";
  let text = theme.fg("toolTitle", theme.bold(`${toolName} `));
  text += theme.fg("accent", String(keyArg));
  return new Text(text, 0, 0);
}

export function renderGenericResult(
  result: { content: Array<{ type: string; text: string }>; details: Record<string, unknown>; isError?: boolean },
  options: ToolRenderResultOptions,
  theme: Theme,
): Component {
  const content = result.content[0];
  const output = content?.type === "text" ? content.text : "";
  const firstLine = output.split("\n")[0];

  if (result.isError) {
    return new Text(theme.fg("error", firstLine || "Error"), 0, 0);
  }

  let text = theme.fg("success", firstLine || "done");

  if (options.expanded) {
    const lines = output.split("\n").slice(1, 20);
    for (const line of lines) {
      text += `\n${theme.fg("dim", line)}`;
    }
  }

  return new Text(text, 0, 0);
}
