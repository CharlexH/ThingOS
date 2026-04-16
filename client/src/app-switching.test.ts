import { describe, expect, it } from "vitest";

import { mapHardwareButtonToApp } from "./app-switching";

describe("mapHardwareButtonToApp", () => {
  it("routes preset1 to home", () => {
    expect(mapHardwareButtonToApp("preset1")).toBe("home");
  });

  it("routes preset2 to spotify and preset3 to magi", () => {
    expect(mapHardwareButtonToApp("preset2")).toBe("spotify");
    expect(mapHardwareButtonToApp("preset3")).toBe("magi");
  });

  it("routes preset4 to settings", () => {
    expect(mapHardwareButtonToApp("preset4")).toBe("settings");
  });

  it("ignores unrelated hardware buttons", () => {
    expect(mapHardwareButtonToApp("knob_press")).toBeNull();
  });
});
