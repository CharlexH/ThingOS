import type {
  AppId,
  ClockAnchor,
  HomePhase,
  HomeTimerState,
  PlaybackDelta,
  PlaybackSnapshot,
  PlaybackStore,
  PlaybackStoreState,
  PreferencesState,
  PreferencesStatePayload
} from "./types";
import type {
  SettingsActionStatus,
  SettingsSectionId,
  SettingsStatePayload,
  SettingsViewState,
  SettingsResultPayload
} from "./types";
import { magiInitial } from "./magi/state";
import type { MagiState } from "./magi/types";

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  status: "idle",
  track: "",
  artist: "",
  album: "",
  artworkUrl: "",
  playing: false,
  position: 0,
  duration: 0,
  volume: 50,
  shuffle: false,
  repeat: false,
  connected: false,
  ts: 0
};

const MAX_TIMER_SECONDS = 5999;
const FLASH_DURATION_MS = 3000;

function clampTimerSeconds(seconds: number): number {
  return Math.max(0, Math.min(MAX_TIMER_SECONDS, seconds));
}

function createClockTimer(): HomeTimerState {
  return {
    mode: "clock",
    phase: "none",
    settingTarget: "none",
    workSeconds: 0,
    restSeconds: 0,
    remainingMs: 0,
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: 0,
    flashKind: "none",
    nextPhaseAfterFlash: "none"
  };
}

function createSetTimer(
  workSeconds: number,
  restSeconds: number,
  settingTarget: "work" | "rest"
): HomeTimerState {
  const clampedWork = clampTimerSeconds(workSeconds);
  const clampedRest = clampTimerSeconds(restSeconds);
  const displaySeconds = settingTarget === "work" ? clampedWork : clampedRest;

  return {
    mode: "set",
    phase: "none",
    settingTarget: settingTarget,
    workSeconds: clampedWork,
    restSeconds: clampedRest,
    remainingMs: displaySeconds * 1000,
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: 0,
    flashKind: "none",
    nextPhaseAfterFlash: "none"
  };
}

function createRunningTimer(
  workSeconds: number,
  restSeconds: number,
  phase: "work" | "rest",
  nowMs: number,
  remainingMs: number
): HomeTimerState {
  const clampedRemaining = Math.max(0, remainingMs);
  const flashKind =
    clampedRemaining > 0 && clampedRemaining <= FLASH_DURATION_MS
      ? (phase === "rest" ? "rest_done" : "countdown_done")
      : "none";

  return {
    mode: "running",
    phase: phase,
    settingTarget: "none",
    workSeconds: clampTimerSeconds(workSeconds),
    restSeconds: clampTimerSeconds(restSeconds),
    remainingMs: clampedRemaining,
    anchorMs: nowMs,
    anchorRemaining: clampedRemaining,
    flashUntilMs: flashKind === "none" ? 0 : nowMs + clampedRemaining,
    flashKind: flashKind,
    nextPhaseAfterFlash: "none"
  };
}

function createPausedTimer(
  workSeconds: number,
  restSeconds: number,
  phase: "work" | "rest",
  remainingMs: number
): HomeTimerState {
  return {
    mode: "paused",
    phase: phase,
    settingTarget: "none",
    workSeconds: clampTimerSeconds(workSeconds),
    restSeconds: clampTimerSeconds(restSeconds),
    remainingMs: Math.max(0, remainingMs),
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: 0,
    flashKind: "none",
    nextPhaseAfterFlash: "none"
  };
}

function createFlashingTimer(
  workSeconds: number,
  restSeconds: number,
  phase: "work" | "rest",
  flashKind: "countdown_done" | "rest_done",
  nextPhaseAfterFlash: HomePhase,
  nowMs: number
): HomeTimerState {
  return {
    mode: "flashing",
    phase: phase,
    settingTarget: "none",
    workSeconds: clampTimerSeconds(workSeconds),
    restSeconds: clampTimerSeconds(restSeconds),
    remainingMs: 0,
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: nowMs + FLASH_DURATION_MS,
    flashKind: flashKind,
    nextPhaseAfterFlash: nextPhaseAfterFlash
  };
}

function createDoneTimer(workSeconds: number, restSeconds: number): HomeTimerState {
  return {
    mode: "done",
    phase: "work",
    settingTarget: "none",
    workSeconds: clampTimerSeconds(workSeconds),
    restSeconds: clampTimerSeconds(restSeconds),
    remainingMs: 0,
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: 0,
    flashKind: "none",
    nextPhaseAfterFlash: "none"
  };
}

function getRunningRemaining(timer: HomeTimerState, nowMs: number): number {
  return Math.max(0, timer.anchorRemaining - Math.max(0, nowMs - timer.anchorMs));
}

export function createPlaybackStore(): PlaybackStore {
  let current = EMPTY_SNAPSHOT;
  let display = EMPTY_SNAPSHOT;
  let progressAnchorTs = 0;
  let activeApp: AppId = "home";
  let homeTimer: HomeTimerState = createClockTimer();
  let preferences: PreferencesState = {
    pomodoroEnabled: false
  };
  let clockAnchor: ClockAnchor = {
    serverTimeMs: 0,
    receivedAtMs: 0,
    timezoneOffsetMinutes: 0
  };
  let settings: SettingsViewState = {
    section: "home",
    data: null,
    loading: false,
    actionStatus: {
      kind: "idle",
      action: "",
      message: ""
    }
  };
  let magi: MagiState = magiInitial();
  let listeners: Array<(state: PlaybackStoreState) => void> = [];

  function snapshot(): PlaybackStoreState {
    return {
      current,
      display,
      status: current.status,
      progressAnchorTs,
      activeApp,
      clockAnchor,
      homeTimer,
      preferences,
      settings,
      magi
    };
  }

  function publish(): void {
    const nextState = snapshot();
    listeners.forEach(function (listener) {
      listener(nextState);
    });
  }

  function enterWorkSetup(): void {
    homeTimer = createSetTimer(homeTimer.workSeconds, homeTimer.restSeconds, "work");
  }

  function enterClock(): void {
    homeTimer = createClockTimer();
  }

  function startRunningPhase(phase: "work" | "rest", nowMs: number, remainingMs: number): void {
    homeTimer = createRunningTimer(homeTimer.workSeconds, homeTimer.restSeconds, phase, nowMs, remainingMs);
  }

  function handlePrimaryAction(nowMs: number): void {
    if (homeTimer.mode === "set") {
      if (homeTimer.settingTarget === "work") {
        if (homeTimer.workSeconds <= 0) {
          return;
        }
        if (preferences.pomodoroEnabled) {
          homeTimer = createSetTimer(homeTimer.workSeconds, homeTimer.restSeconds, "rest");
          publish();
          return;
        }
        startRunningPhase("work", nowMs, homeTimer.workSeconds * 1000);
        publish();
        return;
      }

      if (homeTimer.workSeconds <= 0) {
        return;
      }
      startRunningPhase("work", nowMs, homeTimer.workSeconds * 1000);
      publish();
      return;
    }

    if (homeTimer.mode === "running") {
      homeTimer = createPausedTimer(
        homeTimer.workSeconds,
        homeTimer.restSeconds,
        homeTimer.phase === "rest" ? "rest" : "work",
        getRunningRemaining(homeTimer, nowMs)
      );
      publish();
      return;
    }

    if (homeTimer.mode === "paused") {
      startRunningPhase(
        homeTimer.phase === "rest" ? "rest" : "work",
        nowMs,
        homeTimer.remainingMs
      );
      publish();
      return;
    }

    if (homeTimer.mode === "done" && homeTimer.workSeconds > 0) {
      startRunningPhase("work", nowMs, homeTimer.workSeconds * 1000);
      publish();
    }
  }

  function handleBack(): void {
    if (homeTimer.mode === "clock") {
      return;
    }

    if (homeTimer.mode === "set") {
      if (homeTimer.settingTarget === "rest") {
        enterWorkSetup();
      } else {
        enterClock();
      }
      publish();
      return;
    }

    if (
      homeTimer.mode === "running" ||
      homeTimer.mode === "paused" ||
      homeTimer.mode === "flashing"
    ) {
      enterWorkSetup();
      publish();
      return;
    }

    if (homeTimer.mode === "done") {
      enterClock();
      publish();
    }
  }

  function handleTick(nowMs: number): void {
    if (homeTimer.mode === "running") {
      const remaining = getRunningRemaining(homeTimer, nowMs);

      if (remaining > 0) {
        if (remaining !== homeTimer.remainingMs) {
          const flashKind =
            remaining <= FLASH_DURATION_MS
              ? (homeTimer.phase === "rest" ? "rest_done" : "countdown_done")
              : "none";
          homeTimer = {
            ...homeTimer,
            remainingMs: remaining,
            flashUntilMs: flashKind === "none" ? 0 : homeTimer.anchorMs + homeTimer.anchorRemaining,
            flashKind: flashKind
          };
          publish();
        }
        return;
      }

      if (homeTimer.phase === "rest") {
        startRunningPhase("work", nowMs, homeTimer.workSeconds * 1000);
        publish();
        return;
      }

      if (homeTimer.restSeconds > 0) {
        startRunningPhase("rest", nowMs, homeTimer.restSeconds * 1000);
        publish();
        return;
      }

      homeTimer = createDoneTimer(homeTimer.workSeconds, homeTimer.restSeconds);
      publish();
      return;
    }

    if (homeTimer.mode === "flashing" && nowMs >= homeTimer.flashUntilMs) {
      if (homeTimer.nextPhaseAfterFlash === "work") {
        startRunningPhase("work", nowMs, homeTimer.workSeconds * 1000);
      } else if (homeTimer.nextPhaseAfterFlash === "rest") {
        startRunningPhase("rest", nowMs, homeTimer.restSeconds * 1000);
      } else {
        homeTimer = createDoneTimer(homeTimer.workSeconds, homeTimer.restSeconds);
      }
      publish();
    }
  }

  return {
    applyState(snapshot) {
      current = snapshot;
      if (snapshot.status === "ok") {
        display = snapshot;
      }
      progressAnchorTs = snapshot.ts;
      clockAnchor = {
        serverTimeMs: snapshot.serverTimeMs ?? snapshot.ts,
        receivedAtMs: Date.now(),
        timezoneOffsetMinutes:
          snapshot.serverTimezoneOffsetMinutes ??
          -new Date(snapshot.serverTimeMs ?? snapshot.ts).getTimezoneOffset()
      };
      publish();
    },
    applyDelta(delta: PlaybackDelta) {
      current = {
        ...current,
        position: delta.position,
        ts: delta.ts
      };
      progressAnchorTs = delta.ts;
      if (display.status === "ok") {
        display = {
          ...display,
          position: delta.position,
          ts: delta.ts
        };
      }
      publish();
    },
    applyPreferences(snapshot: PreferencesStatePayload) {
      preferences = {
        pomodoroEnabled: Boolean(snapshot.pomodoroEnabled)
      };
      publish();
    },
    applySettingsState(snapshot: SettingsStatePayload) {
      settings = {
        ...settings,
        data: snapshot,
        loading: false
      };
      publish();
    },
    applySettingsResult(result: SettingsResultPayload) {
      settings = {
        ...settings,
        loading: false,
        actionStatus: {
          kind: result.ok ? "success" : "error",
          action: result.action,
          message: result.message
        }
      };
      publish();
    },
    beginSettingsAction(action: string) {
      settings = {
        ...settings,
        loading: true,
        actionStatus: {
          kind: "loading",
          action: action,
          message: ""
        }
      };
      publish();
    },
    switchApp(app: AppId) {
      activeApp = app;
      publish();
    },
    switchSettingsSection(section: SettingsSectionId) {
      settings = {
        ...settings,
        section: section
      };
      publish();
    },
    timerAdjust(deltaSec: number): void {
      if (
        homeTimer.mode === "running" ||
        homeTimer.mode === "paused" ||
        homeTimer.mode === "flashing"
      ) {
        return;
      }

      if (homeTimer.mode === "clock") {
        if (deltaSec <= 0) {
          return;
        }
        homeTimer = createSetTimer(clampTimerSeconds(deltaSec), 0, "work");
        publish();
        return;
      }

      if (homeTimer.mode === "done") {
        homeTimer = createSetTimer(homeTimer.workSeconds, homeTimer.restSeconds, "work");
      }

      if (homeTimer.mode !== "set") {
        return;
      }

      if (homeTimer.settingTarget === "rest") {
        const nextRest = homeTimer.restSeconds + deltaSec;
        if (nextRest < 0) {
          enterWorkSetup();
          publish();
          return;
        }
        homeTimer = createSetTimer(homeTimer.workSeconds, nextRest, "rest");
        publish();
        return;
      }

      let nextWork = homeTimer.workSeconds + deltaSec;
      if (nextWork <= 0) {
        if (deltaSec < 0 && homeTimer.workSeconds === 0) {
          enterClock();
          publish();
          return;
        }
        nextWork = 0;
      }

      homeTimer = createSetTimer(nextWork, homeTimer.restSeconds, "work");
      publish();
    },
    timerPrimaryAction(nowMs?: number): void {
      handlePrimaryAction(nowMs ?? Date.now());
    },
    timerBack(): void {
      handleBack();
    },
    timerTick(nowMs?: number): void {
      handleTick(nowMs ?? Date.now());
    },
    timerStart(): void {
      handlePrimaryAction(Date.now());
    },
    timerPause(): void {
      if (homeTimer.mode === "running") {
        handlePrimaryAction(Date.now());
      }
    },
    timerResume(): void {
      if (homeTimer.mode === "paused") {
        handlePrimaryAction(Date.now());
      }
    },
    timerDone(): void {
      homeTimer = createDoneTimer(homeTimer.workSeconds, homeTimer.restSeconds);
      publish();
    },
    timerReset(): void {
      enterWorkSetup();
      publish();
    },
    timerExit(): void {
      enterClock();
      publish();
    },
    magiDispatch(fn: (s: MagiState) => MagiState): void {
      magi = fn(magi);
      publish();
    },
    getState(): PlaybackStoreState {
      return snapshot();
    },
    subscribe(listener: (state: PlaybackStoreState) => void): () => void {
      listeners = listeners.concat(listener);
      return function unsubscribe(): void {
        listeners = listeners.filter(function (entry) {
          return entry !== listener;
        });
      };
    },
  };
}
