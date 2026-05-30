import { describe, it, expect, vi } from "vitest";
import { OVWidget } from "./ov-widget";

describe("OVWidget", () => {
  it("renders initial disconnected state", () => {
    const w = new OVWidget();
    const lines = w.render();
    expect(lines[0]).toContain("🔴");
    expect(lines[0]).toContain("disconnected");
    expect(lines[0]).toContain("recall:off");
  });

  it("renders connected state after update", () => {
    const w = new OVWidget();
    w.update("conn", "connected");
    w.update("recall", "on");
    w.update("session", "sess-abc");
    w.update("scope", "viking://kb");

    const lines = w.render();
    expect(lines[0]).toContain("🟢");
    expect(lines[0]).toContain("connected");
    expect(lines[0]).toContain("🔵");
    expect(lines[0]).toContain("recall:on");
    expect(lines[0]).toContain("viking://kb");
    expect(lines[1]).toContain("sess-abc");
  });

  it("attach calls setWidget with render output", () => {
    const w = new OVWidget();
    const setWidget = vi.fn();
    const ui = { setWidget } as any;

    w.attach(ui);

    expect(setWidget).toHaveBeenCalledWith("ov", w.render());
  });

  it("update calls setWidget when attached", () => {
    const w = new OVWidget();
    const setWidget = vi.fn();
    w.attach({ setWidget } as any);

    setWidget.mockClear();
    w.update("recall", "on");

    expect(setWidget).toHaveBeenCalledWith("ov", expect.any(Array));
    const args = setWidget.mock.calls[0][1] as string[];
    expect(args[0]).toContain("recall:on");
  });

  it("update does not throw when not attached", () => {
    const w = new OVWidget();
    expect(() => w.update("recall", "on")).not.toThrow();
  });
});
