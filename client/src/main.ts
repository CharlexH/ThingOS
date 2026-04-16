import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/components.css";

import { mapHardwareButtonToApp } from "./app-switching";
import { bindInputHandlers } from "./input";
import { createMagiInputRouter } from "./magi/input";
import { advanceMockCursor } from "./magi/mock";
import { magiVoiceTick } from "./magi/state";
import { createPlaybackStore } from "./state";
import { createRenderer } from "./ui/renderer";
import { ThingOSSocket } from "./ws-client";

var store = createPlaybackStore();
var socket = new ThingOSSocket(store, "ws://127.0.0.1:8765");
var renderer = createRenderer(document, store, sendCommand, {
  requestSettingsState: function (): void {
    socket.sendSettingsGet();
  },
  sendSettingsSet: function (section, key, value): void {
    socket.sendSettingsSet(section, key, value);
  },
  sendSettingsAction: function (action, params): void {
    socket.sendSettingsAction(action, params);
  }
});
var settingsRefreshTimer = window.setInterval(function () {
  if (store.getState().activeApp === "settings") {
    socket.sendSettingsGet();
  }
}, 2000);

var magiRouter = createMagiInputRouter({
  get: function () { return store.getState().magi; },
  apply: function (fn) { store.magiDispatch(fn); }
});
var magiMockCursor = 0;
var magiRunStartedAt = 0;

window.setInterval(function () {
  var state = store.getState();
  if (state.activeApp !== "magi") return;
  var magi = state.magi;

  if (magi.global === "RUNNING" && magiRunStartedAt === 0) {
    magiRunStartedAt = Date.now();
    magiMockCursor = 0;
  }
  if (magi.global === "IDLE") {
    magiRunStartedAt = 0;
    magiMockCursor = 0;
  }

  if (magi.global === "RUNNING" || magi.global === "REWORK") {
    if (magi.pausedAtMs === 0 && magiRunStartedAt > 0) {
      var advance = advanceMockCursor(magi, magiRunStartedAt, Date.now(), "happy", magiMockCursor);
      magiMockCursor = advance.cursor;
      if (advance.state !== magi) {
        store.magiDispatch(function () { return advance.state; });
      }
    }
  }

  if (magi.voice.open) {
    store.magiDispatch(function (s) { return magiVoiceTick(s, 2); });
  }
}, 100);

function sendCommand(action: string, value?: number): void {
  socket.sendCommand(action, value);
}

store.subscribe(function (state) {
  renderer.render(state);
});

socket.onButton(function (button: string) {
  var state = store.getState();
  // MAGI short-circuits knob_press and back
  if (state.activeApp === "magi") {
    if (button === "knob_press") {
      magiRouter.handleKnobPress();
      return;
    }
    if (button === "back") {
      magiRouter.handleBackButton();
      return;
    }
  }
  // Handle knob_press: playpause on Spotify, timer actions on Home
  if (button === "knob_press" && state.activeApp === "spotify") {
    sendCommand("playpause");
    return;
  }
  if (button === "knob_press" && state.activeApp === "home") {
    var mode = state.homeTimer.mode;
    if (mode === "timer_set") {
      store.timerStart();
      return;
    }
    if (mode === "timer_running") {
      store.timerPause();
      return;
    }
    if (mode === "timer_paused") {
      store.timerResume();
      return;
    }
    if (mode === "timer_done") {
      store.timerStart();
      return;
    }
    return;
  }

  // Handle back button in Home timer modes
  if (button === "back" && state.activeApp === "home") {
    var timerMode = state.homeTimer.mode;
    if (timerMode === "timer_running" || timerMode === "timer_paused") {
      store.timerReset();
      return;
    }
    if (timerMode === "timer_set" || timerMode === "timer_done") {
      store.timerExit();
      return;
    }
    return;
  }

  var app = mapHardwareButtonToApp(button);
  if (app) {
    store.switchApp(app);
    renderer.showPresetHint(button);
    if (app === "settings") {
      socket.sendSettingsGet();
    }
  } else if (button === "back" && state.activeApp === "settings") {
    if (state.settings.section === "home") {
      store.switchApp("home");
    } else {
      store.switchSettingsSection("home");
    }
  }
});

renderer.render(store.getState());
socket.connect();

bindInputHandlers(
  window,
  sendCommand,
  function (button): void {
    var app = mapHardwareButtonToApp(button);
    if (app) {
      store.switchApp(app);
      renderer.showPresetHint(button);
      if (app === "settings") {
        socket.sendSettingsGet();
      }
    }
  },
  function (volume): void {
    renderer.previewVolume(volume);
  },
  function (): number {
    return store.getState().current.volume;
  },
  function (): boolean {
    return store.getState().activeApp === "settings";
  },
  function (delta): void {
    renderer.scrollSettings(delta);
  },
  function (): boolean {
    return store.getState().activeApp === "home";
  },
  function (): string {
    return store.getState().homeTimer.mode;
  },
  function (deltaSec): void {
    store.timerAdjust(deltaSec);
  },
  function (): void {
    var mode = store.getState().homeTimer.mode;
    if (mode === "timer_set" || mode === "timer_done") {
      store.timerStart();
    } else if (mode === "timer_running") {
      store.timerPause();
    } else if (mode === "timer_paused") {
      store.timerResume();
    }
  },
  function (): void {
    var state = store.getState();
    if (state.activeApp === "home") {
      var mode = state.homeTimer.mode;
      if (mode === "timer_running" || mode === "timer_paused") {
        store.timerReset();
      } else if (mode === "timer_set" || mode === "timer_done") {
        store.timerExit();
      }
    } else if (state.activeApp === "settings") {
      if (state.settings.section === "home") {
        store.switchApp("home");
      } else {
        store.switchSettingsSection("home");
      }
    }
  },
  function (): boolean {
    return store.getState().activeApp === "magi";
  },
  magiRouter
);
