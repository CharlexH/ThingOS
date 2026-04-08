import { describe, expect, it } from "vitest";

import { formatClockTime } from "./home-clock";

describe("formatClockTime", () => {
  it("formats the clock using the server timezone offset instead of the device timezone", () => {
    expect(
      formatClockTime(
        {
          serverTimeMs: Date.UTC(2026, 3, 7, 8, 5, 0, 0),
          receivedAtMs: 1000,
          timezoneOffsetMinutes: 480
        },
        1000
      )
    ).toBe("16:05");
  });

  it("advances the clock in the server timezone as local time passes", () => {
    expect(
      formatClockTime(
        {
          serverTimeMs: Date.UTC(2026, 3, 7, 23, 59, 0, 0),
          receivedAtMs: 1000,
          timezoneOffsetMinutes: 60
        },
        61000
      )
    ).toBe("01:00");
  });
});
