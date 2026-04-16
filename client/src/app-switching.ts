import type { AppId } from "./types";

export function mapHardwareButtonToApp(button: string): AppId | null {
  if (button === "preset1") {
    return "home";
  }
  if (button === "preset2") {
    return "spotify";
  }
  if (button === "preset3") {
    return "magi";
  }
  if (button === "preset4") {
    return "settings";
  }
  return null;
}
