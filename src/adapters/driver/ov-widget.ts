import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

export class OVWidget {
  private data: Record<string, string> = {
    conn: "disconnected",
    recall: "off",
    session: "-",
    lastRecall: "",
  };

  private ui: ExtensionUIContext | null = null;
  private hidden = false;

  attach(ui: ExtensionUIContext): void {
    this.ui = ui;
    this.refresh();
  }

  update(field: string, value: string): void {
    this.data[field] = value;
    this.refresh();
  }

  /** Hide the widget immediately. */
  hide(): void {
    this.hidden = true;
    this.refresh();
  }

  /** Show the widget immediately. */
  show(): void {
    this.hidden = false;
    this.refresh();
  }

  /** Toggle visibility. Returns new visible state (true = visible). */
  toggle(): boolean {
    this.hidden = !this.hidden;
    this.refresh();
    return !this.hidden;
  }

  /** Whether the widget is currently visible. */
  isVisible(): boolean {
    return !this.hidden;
  }

  private refresh(): void {
    if (this.ui) {
      this.ui.setWidget("ov", this.hidden ? [] : this.render());
    }
  }

  render(): string[] {
    const { conn, recall, session, lastRecall } = this.data;
    const connIcon = conn === "connected" ? "⚡" : "💤";
    const recallIcon = recall === "on" ? "🧠" : "💤";
    const recallStats = lastRecall ? ` | 📊 ${lastRecall}` : "";
    return [
      `${connIcon} OV | ${recallIcon} recall | 💬 ${session}${recallStats}`,
    ];
  }
}
