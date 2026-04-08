import { describe, expect, it } from "vitest";

import { mapHardwareButtonToApp } from "./app-switching";

describe("mapHardwareButtonToApp", () => {
  it("routes preset1 to spotify", () => {
    expect(mapHardwareButtonToApp("preset1")).toBe("spotify");
  });

  it("routes preset2 through preset4 to home", () => {
    expect(mapHardwareButtonToApp("preset2")).toBe("home");
    expect(mapHardwareButtonToApp("preset3")).toBe("home");
  });

  it("routes preset4 to settings", () => {
    expect(mapHardwareButtonToApp("preset4")).toBe("settings");
  });

  it("ignores unrelated hardware buttons", () => {
    expect(mapHardwareButtonToApp("knob_press")).toBeNull();
  });
});
