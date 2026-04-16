import type { MagiVoiceOverlay } from "../../magi/types";

export interface VoiceOverlayElements {
  root: HTMLElement;
  waveform: HTMLElement;
  transcript: HTMLElement;
  hint: HTMLElement;
}

export function createVoiceOverlay(doc: Document): VoiceOverlayElements {
  const root = doc.createElement("div");
  root.className = "magi-voice-overlay";
  root.hidden = true;

  const waveform = doc.createElement("div");
  waveform.className = "magi-voice-waveform";

  const transcript = doc.createElement("div");
  transcript.className = "magi-voice-transcript";

  const hint = doc.createElement("div");
  hint.className = "magi-voice-hint";
  hint.textContent = "KNOB: COMMIT   BACK: CANCEL";

  root.appendChild(waveform);
  root.appendChild(transcript);
  root.appendChild(hint);

  return { root, waveform, transcript, hint };
}

export function renderVoiceOverlay(el: VoiceOverlayElements, voice: MagiVoiceOverlay): void {
  el.root.hidden = !voice.open;
  if (!voice.open) {
    el.transcript.textContent = "";
    return;
  }
  el.transcript.textContent = voice.transcript.slice(0, voice.typedChars);
}
