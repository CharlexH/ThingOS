import {
  magiStart,
  magiTogglePause,
  magiToggleType,
  magiVoiceOpen,
  magiVoiceCancel,
  magiVoiceCommit
} from "./state";
import type { MagiState } from "./types";

const WHEEL_DEBOUNCE_MS = 200;

export interface MagiInputRouter {
  handleWheel(delta: number): void;
  handleKnobPress(): void;
  handleBackButton(): void;
}

export interface MagiStoreHandle {
  get(): MagiState;
  apply(fn: (s: MagiState) => MagiState): void;
}

export function createMagiInputRouter(store: MagiStoreHandle): MagiInputRouter {
  let lastWheelMs = 0;

  return {
    handleWheel(): void {
      const now = Date.now();
      if (now - lastWheelMs < WHEEL_DEBOUNCE_MS) return;
      lastWheelMs = now;
      store.apply(magiToggleType);
    },
    handleKnobPress(): void {
      const state = store.get();
      if (state.voice.open) {
        store.apply(magiVoiceCommit);
        return;
      }
      if (state.global === "IDLE") {
        store.apply(magiStart);
        return;
      }
      store.apply(magiTogglePause);
    },
    handleBackButton(): void {
      const state = store.get();
      if (state.voice.open) {
        store.apply(magiVoiceCancel);
        return;
      }
      store.apply(magiVoiceOpen);
    }
  };
}
