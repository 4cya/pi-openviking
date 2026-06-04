import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export class OVWidget {
  private data: Record<string, string> = {
    conn: "disconnected",
    recall: "off",
    session: "-",
  };

  private ui: ExtensionUIContext | null = null;

  attach(ui: ExtensionUIContext): void {
    this.ui = ui;
    this.refresh();
  }

  update(field: string, value: string): void {
    this.data[field] = value;
    this.refresh();
  }

  private refresh(): void {
    if (this.ui) {
      this.ui.setWidget("ov", this.render());
    }
  }

  render(): string[] {
    const { conn, recall, session } = this.data;
    const connIcon = conn === "connected" ? "⚡" : "💤";
    const recallIcon = recall === "on" ? "🧠" : "💤";
    return [
      `${connIcon} OV | ${recallIcon} recall | 💬 ${session}`,
    ];
  }
}
