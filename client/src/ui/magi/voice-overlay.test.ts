// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { createVoiceOverlay, renderVoiceOverlay } from "./voice-overlay";
import type { MagiVoiceOverlay } from "../../magi/types";

const BLANK: MagiVoiceOverlay = { open: false, transcript: "", typedChars: 0, cursor: 0 };

describe("renderVoiceOverlay", () => {
  it("is hidden when voice is closed", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, BLANK);
    expect(el.root.hidden).toBe(true);
  });

  it("reveals only the typed prefix of the transcript", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, { open: true, transcript: "hello world", typedChars: 5, cursor: 1 });
    expect(el.root.hidden).toBe(false);
    expect(el.transcript.textContent).toBe("hello");
  });

  it("shows the keymap hint", () => {
    const el = createVoiceOverlay(document);
    renderVoiceOverlay(el, { open: true, transcript: "x", typedChars: 0, cursor: 1 });
    expect(el.hint.textContent).toMatch(/KNOB.*COMMIT/);
    expect(el.hint.textContent).toMatch(/BACK.*CANCEL/);
  });
});
