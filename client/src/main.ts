import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/components.css";

import { mapHardwareButtonToApp } from "./app-switching";
import { bindInputHandlers } from "./input";
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

function sendCommand(action: string, value?: number): void {
  socket.sendCommand(action, value);
}

store.subscribe(function (state) {
  renderer.render(state);
});

socket.onButton(function (button: string) {
  var state = store.getState();
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
  }
);
