export const MAGI_TRANSCRIPTS: readonly string[] = [
  "tighten evaluation rubric around state coverage",
  "add a loading skeleton to the hex cluster",
  "reduce handoff count budget to two",
  "switch backend to codex for the next pass",
  "mark this run as a design exploration not a ship candidate"
] as const;

export function pickTranscript(cursor: number): string {
  const n = MAGI_TRANSCRIPTS.length;
  const idx = ((cursor % n) + n) % n;
  return MAGI_TRANSCRIPTS[idx];
}
