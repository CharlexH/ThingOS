import type { AppId } from "./types";

export function mapHardwareButtonToApp(button: string): AppId | null {
  if (button === "preset1") {
    return "spotify";
  }
  if (button === "preset2" || button === "preset3") {
    return "home";
  }
  if (button === "preset4") {
    return "settings";
  }
  return null;
}
