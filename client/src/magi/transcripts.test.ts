import { describe, expect, it } from "vitest";

import { MAGI_TRANSCRIPTS, pickTranscript } from "./transcripts";

describe("MAGI_TRANSCRIPTS", () => {
  it("has 5 plausible dictation lines", () => {
    expect(MAGI_TRANSCRIPTS).toHaveLength(5);
    MAGI_TRANSCRIPTS.forEach((line) => {
      expect(line.length).toBeGreaterThan(20);
      expect(line.length).toBeLessThan(120);
    });
  });
});

describe("pickTranscript", () => {
  it("round-robins through the pool", () => {
    expect(pickTranscript(0)).toBe(MAGI_TRANSCRIPTS[0]);
    expect(pickTranscript(1)).toBe(MAGI_TRANSCRIPTS[1]);
    expect(pickTranscript(4)).toBe(MAGI_TRANSCRIPTS[4]);
    expect(pickTranscript(5)).toBe(MAGI_TRANSCRIPTS[0]);
    expect(pickTranscript(12)).toBe(MAGI_TRANSCRIPTS[2]);
  });
});
