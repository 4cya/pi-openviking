import { describe, test, expect } from "vitest";
import { renderMemsearchCall, renderMemsearchResult, renderMemreadCall, renderMemreadResult, renderGenericCall, renderGenericResult } from "../src/shared/render";
import type { ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { defineTool, type ToolDef } from "../src/shared/tool-def";
import { vi } from "vitest";
import { Theme } from "@earendil-works/pi-coding-agent";

function makeTheme() {
  return new Theme(
    // fgColors — hex values
    {
      accent: "#00ffff", border: "#ffffff", borderAccent: "#00ffff", borderMuted: "#888888",
      success: "#00ff00", error: "#ff0000", warning: "#ffff00", muted: "#888888",
      dim: "#666666", text: "#ffffff", thinkingText: "#ffffff", userMessageText: "#ffffff",
      customMessageText: "#ffffff", customMessageLabel: "#00ffff", toolTitle: "#00ffff",
      toolOutput: "#ffffff", mdHeading: "#ffffff", mdLink: "#00ffff", mdLinkUrl: "#00ffff",
      mdCode: "#ffff00", mdCodeBlock: "#ffff00", mdCodeBlockBorder: "#888888",
      mdQuote: "#888888", mdQuoteBorder: "#888888", mdHr: "#888888", mdListBullet: "#888888",
      toolDiffAdded: "#00ff00", toolDiffRemoved: "#ff0000", syntaxKeyword: "#ff00ff",
      syntaxString: "#ffff00", syntaxComment: "#888888", syntaxNumber: "#ffff00",
      syntaxType: "#00ffff", syntaxOperator: "#ffffff", syntaxPunctuation: "#ffffff",
      thinkingOff: "#888888", thinkingMinimal: "#888888", thinkingLow: "#ffff00",
      thinkingMedium: "#ffff00", thinkingHigh: "#ffff00", thinkingXhigh: "#ffff00",
      bashMode: "#00ffff",
    } as any,
    // bgColors — hex values
    {
      selectedBg: "#ffffff", userMessageBg: "#000000", customMessageBg: "#000000",
      toolPendingBg: "#ffff00", toolSuccessBg: "#00ff00", toolErrorBg: "#ff0000",
    },
    "truecolor",
  );
}

describe("memsearch renderers", () => {
  const theme = makeTheme();

  test("collapsed call shows query + mode + count", () => {
    const args = { query: "auth middleware", limit: 5, mode: "deep" };
    const result = {
      content: [{ type: "text" as const, text: JSON.stringify({ total: 3, memories: [{}, {}], resources: [{}] }) }],
      details: {},
    };

    const component: any = renderMemsearchCall(args, theme);

    expect(component.text).toContain("auth middleware");
    expect(component.text).toContain("deep");
  });

  test("collapsed result shows result count", () => {
    const result = {
      content: [{ type: "text" as const, text: JSON.stringify({ total: 3, memories: [{}, {}], resources: [{}] }) }],
      details: {},
    };

    const component: any = renderMemsearchResult(result, { expanded: false, isPartial: false }, theme);

    expect(component.text).toContain("3");
  });

  test("expanded result shows formatted JSON", () => {
    const payload = { total: 2, memories: [{ text: "mem1" }], resources: [{ uri: "viking://x" }] };
    const result = {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
      details: {},
    };

    const component: any = renderMemsearchResult(result, { expanded: true, isPartial: false }, theme);

    expect(component.text).toContain("mem1");
    expect(component.text).toContain("viking://x");
  });
});

describe("memread renderers", () => {
  const theme = makeTheme();

  test("collapsed call shows URI + level", () => {
    const args = { uri: "viking://resources/docs.md", level: "overview" };

    const component: any = renderMemreadCall(args, theme);

    expect(component.text).toContain("viking://resources/docs.md");
    expect(component.text).toContain("overview");
  });

  test("collapsed result shows URI + level resolved", () => {
    const result = {
      content: [{ type: "text" as const, text: "File content here" }],
      details: {},
    };

    const component: any = renderMemreadResult(result, { expanded: false, isPartial: false }, theme);

    expect(component.text).toContain("1 lines");
  });

  test("expanded result shows content snippet", () => {
    const result = {
      content: [{ type: "text" as const, text: "Line 1\nLine 2\nLine 3" }],
      details: {},
    };

    const component: any = renderMemreadResult(result, { expanded: true, isPartial: false }, theme);

    expect(component.text).toContain("Line 1");
    expect(component.text).toContain("Line 3");
  });
});

describe("generic renderers (membrowse/memcommit/memdelete/memimport)", () => {
  const theme = makeTheme();

  test("collapsed call shows tool name + key arg", () => {
    const component: any = renderGenericCall("membrowse", { uri: "viking://resources/", view: "list" }, theme);
    expect(component.text).toContain("membrowse");
    expect(component.text).toContain("viking://resources/");
  });

  test("collapsed result shows status text", () => {
    const result = {
      content: [{ type: "text" as const, text: "URI: viking://resources/\nChildren:\n- viking://resources/docs.md (file)" }],
      details: {},
    };
    const component: any = renderGenericResult(result, { expanded: false, isPartial: false }, theme);
    expect(component.text).toContain("URI: viking://resources/");
  });

  test("expanded result shows full output", () => {
    const result = {
      content: [{ type: "text" as const, text: "URI: viking://resources/\nChildren:\n- viking://resources/docs.md (file)" }],
      details: {},
    };
    const component: any = renderGenericResult(result, { expanded: true, isPartial: false }, theme);
    expect(component.text).toContain("Children");
    expect(component.text).toContain("docs.md");
  });

  test("error result shows error text", () => {
    const result = {
      content: [{ type: "text" as const, text: "OpenViking server is unavailable" }],
      details: {},
      isError: true,
    };
    const component: any = renderGenericResult(result, { expanded: false, isPartial: false }, theme);
    expect(component.text).toContain("unavailable");
  });

  test("memcommit generic call shows tool name", () => {
    const component: any = renderGenericCall("memcommit", { wait: true }, theme);
    expect(component.text).toContain("memcommit");
  });

  test("memdelete generic call shows URI", () => {
    const component: any = renderGenericCall("memdelete", { uri: "viking://resources/old.md" }, theme);
    expect(component.text).toContain("memdelete");
    expect(component.text).toContain("viking://resources/old.md");
  });

  test("memimport generic call shows source", () => {
    const component: any = renderGenericCall("memimport", { source: "https://example.com/doc.md" }, theme);
    expect(component.text).toContain("memimport");
    expect(component.text).toContain("https://example.com/doc.md");
  });
});

describe("defineTool renderer passthrough", () => {
  test("passes renderCall and renderResult to registerTool", () => {
    const tools: any[] = [];
    const pi = {
      registerTool: vi.fn((def: any) => tools.push(def)),
    } as any;
    const deps = {
      session: { createSession: vi.fn() } as any,
      fs: { read: vi.fn() } as any,
      knowledge: { search: vi.fn() } as any,
      sync: { getOvSessionId: vi.fn() } as any,
    };

    const mockRenderCall = vi.fn();
    const mockRenderResult = vi.fn();

    defineTool(pi, deps as any, {
      name: "test-tool",
      label: "Test",
      description: "test",
      promptSnippet: "test",
      parameters: {} as any,
      execute: vi.fn(async () => ({ text: "ok" })),
      renderCall: mockRenderCall as any,
      renderResult: mockRenderResult as any,
    });

    expect(pi.registerTool).toHaveBeenCalledOnce();
    const registered = tools[0];
    expect(registered.renderCall).toBe(mockRenderCall);
    expect(registered.renderResult).toBe(mockRenderResult);
  });

  test("tools without renderers get no renderCall/renderResult", () => {
    const tools: any[] = [];
    const pi = {
      registerTool: vi.fn((def: any) => tools.push(def)),
    } as any;
    const deps = {
      session: { createSession: vi.fn() } as any,
      fs: { read: vi.fn() } as any,
      knowledge: { search: vi.fn() } as any,
      sync: { getOvSessionId: vi.fn() } as any,
    };

    defineTool(pi, deps as any, {
      name: "bare-tool",
      label: "Bare",
      description: "bare",
      promptSnippet: "bare",
      parameters: {} as any,
      execute: vi.fn(async () => ({ text: "ok" })),
    });

    const registered = tools[0];
    expect(registered.renderCall).toBeUndefined();
    expect(registered.renderResult).toBeUndefined();
  });
});
