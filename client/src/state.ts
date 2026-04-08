import type {
  AppId,
  ClockAnchor,
  HomeTimerState,
  PlaybackDelta,
  PlaybackSnapshot,
  PlaybackStore,
  PlaybackStoreState
} from "./types";
import type {
  SettingsActionStatus,
  SettingsSectionId,
  SettingsStatePayload,
  SettingsViewState,
  SettingsResultPayload
} from "./types";

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

export function createPlaybackStore(): PlaybackStore {
  let current = EMPTY_SNAPSHOT;
  let display = EMPTY_SNAPSHOT;
  let progressAnchorTs = 0;
  let activeApp: AppId = "spotify";
  let homeTimer: HomeTimerState = {
    mode: "clock",
    setSeconds: 0,
    remainingMs: 0,
    anchorMs: 0,
    anchorRemaining: 0,
    flashUntilMs: 0
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
  var listeners: Array<(state: PlaybackStoreState) => void> = [];

  function snapshot(): PlaybackStoreState {
    return {
      current,
      display,
      status: current.status,
      progressAnchorTs,
      activeApp,
      clockAnchor,
      homeTimer,
      settings
    };
  }

  function publish(): void {
    var nextState = snapshot();
    listeners.forEach(function (listener) {
      listener(nextState);
    });
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
      var mode = homeTimer.mode;
      if (mode === "timer_running" || mode === "timer_paused") {
        return;
      }
      if (mode === "clock") {
        if (deltaSec <= 0) {
          return;
        }
        homeTimer = {
          ...homeTimer,
          mode: "timer_set",
          setSeconds: deltaSec,
          remainingMs: deltaSec * 1000
        };
        publish();
        return;
      }
      // timer_set or timer_done
      var next = homeTimer.setSeconds + deltaSec;
      if (next <= 0) {
        if (deltaSec < 0 && homeTimer.setSeconds === 0) {
          // left past 00:00 → back to clock
          homeTimer = { ...homeTimer, mode: "clock", setSeconds: 0, remainingMs: 0 };
          publish();
          return;
        }
        next = 0;
      }
      if (next > 5999) {
        next = 5999; // 99:59
      }
      var newMode = next === 0 ? homeTimer.mode : "timer_set";
      homeTimer = {
        ...homeTimer,
        mode: newMode,
        setSeconds: next,
        remainingMs: next * 1000
      };
      publish();
    },
    timerStart(): void {
      var now = Date.now();
      var remaining = homeTimer.mode === "timer_done"
        ? homeTimer.setSeconds * 1000
        : homeTimer.remainingMs;
      homeTimer = {
        ...homeTimer,
        mode: "timer_running",
        remainingMs: remaining,
        anchorMs: now,
        anchorRemaining: remaining,
        flashUntilMs: 0
      };
      publish();
    },
    timerPause(): void {
      var now = Date.now();
      var elapsed = now - homeTimer.anchorMs;
      var remaining = Math.max(0, homeTimer.anchorRemaining - elapsed);
      homeTimer = {
        ...homeTimer,
        mode: "timer_paused",
        remainingMs: remaining
      };
      publish();
    },
    timerResume(): void {
      var now = Date.now();
      homeTimer = {
        ...homeTimer,
        mode: "timer_running",
        anchorMs: now,
        anchorRemaining: homeTimer.remainingMs
      };
      publish();
    },
    timerDone(): void {
      homeTimer = {
        ...homeTimer,
        mode: "timer_done",
        remainingMs: 0,
        flashUntilMs: Date.now() + 3000
      };
      publish();
    },
    timerReset(): void {
      homeTimer = {
        ...homeTimer,
        mode: "timer_set",
        remainingMs: homeTimer.setSeconds * 1000,
        anchorMs: 0,
        anchorRemaining: 0,
        flashUntilMs: 0
      };
      publish();
    },
    timerExit(): void {
      homeTimer = {
        mode: "clock",
        setSeconds: 0,
        remainingMs: 0,
        anchorMs: 0,
        anchorRemaining: 0,
        flashUntilMs: 0
      };
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
