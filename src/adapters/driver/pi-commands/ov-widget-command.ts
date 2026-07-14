import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export interface WidgetToggleServices {
  /** Hide the widget. */
  widgetHide: () => void;
  /** Show the widget. */
  widgetShow: () => void;
  /** Toggle visibility. Returns new visible state (true = visible). */
  widgetToggle: () => boolean;
  /** Whether the widget is currently visible. */
  widgetVisible: () => boolean;
}

export function createOvWidgetCommand(svcs: WidgetToggleServices) {
  return {
    description: "Show, hide, or toggle the OV status bar widget above the input box. Usage: /ov-widget [on|off|toggle] (default: toggle).",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const arg = args.trim().toLowerCase();

      let visible: boolean;
      if (arg === "on" || arg === "show") {
        svcs.widgetShow();
        visible = true;
      } else if (arg === "off" || arg === "hide") {
        svcs.widgetHide();
        visible = false;
      } else {
        // toggle (default)
        visible = svcs.widgetToggle();
      }

      ctx.ui.notify(
        visible ? "OV widget shown" : "OV widget hidden",
        visible ? "info" : "warning",
      );

      // Prompt to persist the preference across restarts
      if (!arg) {
        ctx.ui.notify(
          "Tip: use /ov-widget on|off to set; add ui.showWidget to ~/.pi/agent/pi-openviking.json to persist permanently.",
          "info",
        );
      }
    },
  };
}
