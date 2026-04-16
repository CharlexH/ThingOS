function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export interface VolumeWheelAccumulator {
  flush(): number;
  preview(): number;
  pushTick(direction: number): void;
}

export function createVolumeWheelAccumulator(
  initialVolume: number,
  step: number
): VolumeWheelAccumulator {
  var baseVolume = initialVolume;
  var pendingTicks = 0;

  return {
    flush(): number {
      var next = clamp(baseVolume + pendingTicks * step, 0, 100);
      pendingTicks = 0;
      baseVolume = next;
      return next;
    },
    preview(): number {
      return clamp(baseVolume + pendingTicks * step, 0, 100);
    },
    pushTick(direction: number): void {
      pendingTicks += direction;
    }
  };
}

export interface MagiInputRouter {
  handleWheel(delta: number): void;
  handleKnobPress(): void;
  handleBackButton(): void;
}

export function bindInputHandlers(
  target: Window,
  sendCommand: (action: string, value?: number) => void,
  handlePresetButton: (button: string) => void,
  previewVolume: (volume: number) => void,
  readVolume: () => number,
  isSettingsActive: () => boolean,
  scrollSettings: (delta: number) => void,
  isHomeActive: () => boolean,
  getHomeTimerMode: () => string,
  adjustTimer: (deltaSec: number) => void,
  handleKnobPress: () => void,
  handleBackButton: () => void,
  isMagiActive: () => boolean,
  magiRouter: MagiInputRouter
): void {
  var flushTimer = 0;
  var lastSentVolume = -1;
  var accumulator: VolumeWheelAccumulator | null = null;

  target.addEventListener("wheel", function (event: WheelEvent) {
    event.preventDefault();
    var delta = event.deltaX || event.deltaY;
    if (isMagiActive()) {
      magiRouter.handleWheel(delta);
      return;
    }
    if (isSettingsActive()) {
      scrollSettings(delta);
      return;
    }
    if (isHomeActive()) {
      var timerMode = getHomeTimerMode();
      if (timerMode === "running" || timerMode === "paused" || timerMode === "flashing") {
        return;
      }
      var dir = delta > 0 ? 1 : -1;
      adjustTimer(dir * 60);
      return;
    }
    if (!accumulator) {
      accumulator = createVolumeWheelAccumulator(lastSentVolume >= 0 ? lastSentVolume : readVolume(), 5);
    }
    accumulator.pushTick(delta > 0 ? 1 : -1);
    previewVolume(accumulator.preview());
    target.clearTimeout(flushTimer);
    flushTimer = target.setTimeout(function () {
      var next = accumulator ? accumulator.flush() : (lastSentVolume >= 0 ? lastSentVolume : readVolume());
      accumulator = null;
      lastSentVolume = next;
      sendCommand("volume", next);
    }, 16);
  }, { passive: false });

  target.addEventListener("keydown", function (event: KeyboardEvent) {
    if (isMagiActive()) {
      if (event.key === "Escape") {
        event.preventDefault();
        magiRouter.handleBackButton();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        magiRouter.handleKnobPress();
        return;
      }
      if (event.key === "1") { event.preventDefault(); handlePresetButton("preset1"); return; }
      if (event.key === "2") { event.preventDefault(); handlePresetButton("preset2"); return; }
      if (event.key === "4") { event.preventDefault(); handlePresetButton("preset4"); return; }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleBackButton();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (isHomeActive()) {
        handleKnobPress();
      } else {
        sendCommand("playpause");
      }
    } else if (event.key === "1") {
      event.preventDefault();
      handlePresetButton("preset1");
    } else if (event.key === "2") {
      event.preventDefault();
      handlePresetButton("preset2");
    } else if (event.key === "3") {
      event.preventDefault();
      handlePresetButton("preset3");
    } else if (event.key === "4") {
      event.preventDefault();
      handlePresetButton("preset4");
    }
  });
}
