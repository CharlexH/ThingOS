// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

import { createHomeClockElements, formatClockTime, renderHomeClock } from "./home-clock";

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

describe("renderHomeClock", () => {
  it("marks COUNTDOWN with the countdown subtitle color", () => {
    const elements = createHomeClockElements(document);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "set",
        phase: "none",
        settingTarget: "work",
        workSeconds: 1500,
        restSeconds: 0,
        remainingMs: 1500000,
        anchorMs: 0,
        anchorRemaining: 0,
        flashUntilMs: 0,
        flashKind: "none",
        nextPhaseAfterFlash: "none",
        setSeconds: 1500
      } as any
    );

    expect(elements.date.textContent).toBe("COUNTDOWN");
    expect(elements.date.classList.contains("home-clock-date-countdown")).toBe(true);
  });

  it("shows REST while configuring rest time", () => {
    const elements = createHomeClockElements(document);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "set",
        phase: "none",
        settingTarget: "rest",
        workSeconds: 1500,
        restSeconds: 300,
        remainingMs: 300000,
        anchorMs: 0,
        anchorRemaining: 0,
        flashUntilMs: 0,
        flashKind: "none",
        nextPhaseAfterFlash: "none",
        setSeconds: 300
      } as any
    );

    expect(elements.date.textContent).toBe("REST");
    expect(elements.date.classList.contains("home-clock-date-rest")).toBe(true);
    expect(elements.hours.textContent).toBe("05");
    expect(elements.minutes.textContent).toBe("00");
  });

  it("uses a solid green background while resting", () => {
    const elements = createHomeClockElements(document);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "running",
        phase: "rest",
        settingTarget: "none",
        workSeconds: 1500,
        restSeconds: 300,
        remainingMs: 300000,
        anchorMs: 1000,
        anchorRemaining: 300000,
        flashUntilMs: 0,
        flashKind: "none",
        nextPhaseAfterFlash: "none",
        setSeconds: 300
      } as any
    );

    expect(elements.root.classList.contains("home-screen-resting")).toBe(true);
    now.mockRestore();
  });

  it("marks WORKING with the countdown subtitle color", () => {
    const elements = createHomeClockElements(document);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "running",
        phase: "work",
        settingTarget: "none",
        workSeconds: 1500,
        restSeconds: 300,
        remainingMs: 300000,
        anchorMs: 1000,
        anchorRemaining: 300000,
        flashUntilMs: 0,
        flashKind: "none",
        nextPhaseAfterFlash: "none",
        setSeconds: 300
      } as any
    );

    expect(elements.date.textContent).toBe("WORKING");
    expect(elements.date.classList.contains("home-clock-date-working")).toBe(true);
    now.mockRestore();
  });

  it("starts the work flash during the last 3 seconds before rest begins", () => {
    const elements = createHomeClockElements(document);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "running",
        phase: "work",
        settingTarget: "none",
        workSeconds: 120,
        restSeconds: 60,
        remainingMs: 3000,
        anchorMs: 1000,
        anchorRemaining: 3000,
        flashUntilMs: 4000,
        flashKind: "countdown_done",
        nextPhaseAfterFlash: "none",
        setSeconds: 3
      } as any
    );

    expect(elements.root.classList.contains("home-clock-flash-white")).toBe(true);
    expect(elements.hours.textContent).toBe("00");
    expect(elements.minutes.textContent).toBe("03");
    expect(elements.date.textContent).toBe("WORKING");
    now.mockRestore();
  });

  it("starts the rest flash during the last 3 seconds before work resumes", () => {
    const elements = createHomeClockElements(document);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);

    renderHomeClock(
      elements,
      {
        serverTimeMs: 0,
        receivedAtMs: 0,
        timezoneOffsetMinutes: 0
      },
      {
        mode: "running",
        phase: "rest",
        settingTarget: "none",
        workSeconds: 1500,
        restSeconds: 300,
        remainingMs: 3000,
        anchorMs: 1000,
        anchorRemaining: 3000,
        flashUntilMs: 4000,
        flashKind: "rest_done",
        nextPhaseAfterFlash: "none",
        setSeconds: 3
      } as any
    );

    expect(elements.root.classList.contains("home-clock-flash-green")).toBe(true);
    expect(elements.hours.textContent).toBe("00");
    expect(elements.minutes.textContent).toBe("03");
    expect(elements.date.textContent).toBe("RESTING");
    now.mockRestore();
  });
});
