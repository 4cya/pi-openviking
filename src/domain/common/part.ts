export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolPart {
  type: "tool";
  toolId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  toolStatus: string;
  toolOutputTruncated: boolean;
  toolUri: string;
  skillUri: string;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  toolOutputRef: string;
}

export interface ContextPart {
  type: "context";
  uri: string;
  contextType: "memory" | "resource" | "skill";
  abstract: string;
}

export type Part = TextPart | ToolPart | ContextPart;
