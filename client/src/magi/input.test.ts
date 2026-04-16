// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createMagiInputRouter } from "./input";
import { magiInitial } from "./state";
import type { MagiState } from "./types";

function mkStore() {
  let state: MagiState = magiInitial();
  return {
    get: () => state,
    apply: (fn: (s: MagiState) => MagiState) => { state = fn(state); }
  };
}

describe("createMagiInputRouter", () => {
  it("wheel toggles TYPE (debounced at ~200 ms)", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);

    router.handleWheel(1);
    expect(store.get().modelType).toBe("CDX");

    // Second tick inside debounce window: ignored.
    vi.spyOn(Date, "now").mockReturnValue(1100);
    router.handleWheel(1);
    expect(store.get().modelType).toBe("CDX");

    // Outside debounce: toggle again.
    vi.spyOn(Date, "now").mockReturnValue(1300);
    router.handleWheel(-1);
    expect(store.get().modelType).toBe("CLD");
  });

  it("knob press starts the run when IDLE", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();
    expect(store.get().global).toBe("RUNNING");
  });

  it("knob press pauses/resumes a running run", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();   // start
    vi.spyOn(Date, "now").mockReturnValue(2000);
    router.handleKnobPress();   // pause
    expect(store.get().pausedAtMs).toBe(2000);
    vi.spyOn(Date, "now").mockReturnValue(4000);
    router.handleKnobPress();   // resume
    expect(store.get().pausedAtMs).toBe(0);
  });

  it("back opens voice overlay, back again cancels", () => {
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleBackButton();
    expect(store.get().voice.open).toBe(true);
    router.handleBackButton();
    expect(store.get().voice.open).toBe(false);
  });

  it("knob press commits voice overlay when open", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = mkStore();
    const router = createMagiInputRouter(store);
    router.handleKnobPress();     // start run
    router.handleBackButton();    // open voice
    expect(store.get().voice.open).toBe(true);
    router.handleKnobPress();     // commit
    expect(store.get().voice.open).toBe(false);
    expect(store.get().stages.planning.summary.length).toBe(1);
  });
});
