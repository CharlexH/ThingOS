import type { PlaybackStore, PlaybackStoreState } from "../types";
import { createHomeClockElements, renderHomeClock } from "./home-clock";
import { createArtworkElements, renderArtwork } from "./artwork";
import { createBackgroundElements, renderBackground } from "./background";
import { createMagiElements, renderMagi, type MagiElements } from "./magi";
import { createProgressElements, syncProgressAnimation, updateProgressLabels } from "./progress";
import {
  createSettingsElements,
  renderSettings,
  scrollSettings as applySettingsScroll,
  type SettingsRenderHandlers
} from "./settings";
import { createTransportControls, renderTransportControls } from "./transport-controls";
import { createTrackInfoElements, renderTrackInfo } from "./track-info";
import { createVolumeOverlay, renderVolumeOverlay } from "./volume";

export interface AppRenderer {
  previewVolume(volume: number): void;
  render(state: PlaybackStoreState): void;
  scrollSettings(delta: number): void;
  showPresetHint(button: string): void;
}

export interface SettingsRendererActions {
  requestSettingsState(): void;
  sendSettingsSet(section: string, key: string, value: string | number | boolean): void;
  sendSettingsAction(action: string, params?: Record<string, string>): void;
}

export function createRenderer(
  documentRef: Document,
  store: PlaybackStore,
  sendCommand: (action: string, value?: number) => void,
  settingsActions?: SettingsRendererActions
): AppRenderer {
  var app = documentRef.getElementById("app");
  if (!app) {
    throw new Error("Missing #app root");
  }

  var shell = documentRef.createElement("main");
  var artworkPanel = documentRef.createElement("section");
  var infoPanel = documentRef.createElement("section");
  var infoPanelMain = documentRef.createElement("div");
  var infoPanelFooter = documentRef.createElement("div");
  var statusBadge = documentRef.createElement("div");
  var presetHintOverlay = documentRef.createElement("div");
  var presetHintButtons = ["preset1", "preset2", "preset3", "preset4"];
  var presetHintLabels = ["Spotify", "Home", "MAGI", "Settings"];
  var homeClock = createHomeClockElements(documentRef);
  var resolvedSettingsActions = settingsActions || {
    requestSettingsState: function (): void {},
    sendSettingsSet: function (): void {},
    sendSettingsAction: function (): void {}
  };
  var settingsHandlers: SettingsRenderHandlers = {
    openSection: function (section) {
      store.switchSettingsSection(section);
      resolvedSettingsActions.requestSettingsState();
    },
    goBack: function () {
      store.switchSettingsSection("home");
    },
    requestState: function () {
      resolvedSettingsActions.requestSettingsState();
    },
    sendSettingsSet: function (section, key, value) {
      store.beginSettingsAction(section + "." + key);
      resolvedSettingsActions.sendSettingsSet(section, key, value);
    },
    sendSettingsAction: function (action, params) {
      store.beginSettingsAction(action);
      resolvedSettingsActions.sendSettingsAction(action, params);
    }
  };
  var settingsScreen = createSettingsElements(documentRef, settingsHandlers);

  shell.className = "app-shell spotify-screen";
  artworkPanel.className = "artwork-panel";
  infoPanel.className = "info-panel";
  infoPanelMain.className = "info-panel-main";
  infoPanelFooter.className = "info-panel-footer";
  statusBadge.className = "status-badge";
  presetHintOverlay.className = "preset-hint-overlay";

  var background = createBackgroundElements(documentRef);
  var artwork = createArtworkElements(documentRef);
  var trackInfo = createTrackInfoElements(documentRef);
  var progress = createProgressElements(documentRef);
  var volume = createVolumeOverlay(documentRef);
  var transport = createTransportControls(documentRef, sendCommand);
  var lastState = store.getState();
  var optimisticVolume: number | null = null;
  var optimisticVolumeUntilMs = 0;
  var timerHost = documentRef.defaultView || window;
  var hidePresetHintTimer = 0;
  var timeoutHost = typeof timerHost.setTimeout === "function" ? timerHost : window;
  var clearTimeoutHost = typeof timerHost.clearTimeout === "function" ? timerHost : window;

  presetHintLabels.forEach(function (label, index) {
    var item = documentRef.createElement("div");
    item.className = "preset-hint-item";
    item.setAttribute("data-button", presetHintButtons[index]);
    item.textContent = label;
    presetHintOverlay.appendChild(item);
  });

  shell.appendChild(background.root);
  artworkPanel.appendChild(artwork.primary);
  artworkPanel.appendChild(artwork.secondary);
  infoPanelMain.appendChild(trackInfo.title);
  infoPanelMain.appendChild(trackInfo.artist);
  infoPanelMain.appendChild(trackInfo.album);
  infoPanelMain.appendChild(statusBadge);
  infoPanelFooter.appendChild(volume.root);
  infoPanelFooter.appendChild(transport.root);
  infoPanel.appendChild(infoPanelMain);
  infoPanel.appendChild(infoPanelFooter);

  shell.appendChild(artworkPanel);
  shell.appendChild(infoPanel);
  shell.appendChild(progress.root);
  app.appendChild(shell);
  app.appendChild(homeClock.root);
  app.appendChild(settingsScreen.root);
  var magiScreen: MagiElements = createMagiElements(documentRef);
  magiScreen.root.hidden = true;
  app.appendChild(magiScreen.root);
  app.appendChild(presetHintOverlay);

  timerHost.setInterval(function () {
    if (lastState.activeApp === "home") {
      var timer = lastState.homeTimer;
      // Check if running timer has reached 0
      if (timer.mode === "timer_running") {
        var elapsed = Date.now() - timer.anchorMs;
        if (timer.anchorRemaining - elapsed <= 0) {
          store.timerDone();
          return;
        }
      }
      renderHomeClock(homeClock, lastState.clockAnchor, timer);
    }
  }, 250);
  timerHost.setInterval(function () {
    if (lastState.activeApp === "spotify") {
      updateProgressLabels(progress, lastState.current, lastState.progressAnchorTs);
    }
  }, 250);

  return {
    previewVolume(volumeValue: number): void {
      optimisticVolume = volumeValue;
      optimisticVolumeUntilMs = Date.now() + 1000;
      if (lastState.activeApp === "spotify") {
        renderVolumeOverlay(volume, volumeValue);
      }
    },
    render(state: PlaybackStoreState): void {
      var now = Date.now();
      var displayVolume = state.current.volume;

      lastState = state;
      shell.hidden = state.activeApp !== "spotify";
      homeClock.root.hidden = state.activeApp !== "home";
      settingsScreen.root.hidden = state.activeApp !== "settings";
      magiScreen.root.hidden = state.activeApp !== "magi";
      if (state.activeApp === "magi") {
        renderMagi(magiScreen, state.magi);
        return;
      }
      if (state.activeApp === "home") {
        renderHomeClock(homeClock, state.clockAnchor, state.homeTimer);
        return;
      }
      if (state.activeApp === "settings") {
        renderSettings(documentRef, settingsScreen, state.settings, settingsHandlers);
        return;
      }

      if (optimisticVolume !== null) {
        if (state.current.volume === optimisticVolume || now > optimisticVolumeUntilMs) {
          optimisticVolume = null;
        } else {
          displayVolume = optimisticVolume;
        }
      }

      renderBackground(documentRef, background, state.display.artworkUrl);
      renderArtwork(artwork, state.display.artworkUrl);
      renderTrackInfo(trackInfo, state.display);
      syncProgressAnimation(progress, state.current, state.progressAnchorTs);
      renderTransportControls(transport, state.current);
      renderVolumeOverlay(volume, displayVolume);
      statusBadge.textContent = state.status === "ok" ? "" : state.status.replace(/_/g, " ");
      statusBadge.hidden = state.status === "ok";
    },
    scrollSettings(delta: number): void {
      applySettingsScroll(settingsScreen, delta);
    },
    showPresetHint(button: string): void {
      Array.from(presetHintOverlay.children).forEach(function (child) {
        var item = child as HTMLElement;
        var isActive = item.getAttribute("data-button") === button;
        item.classList.toggle("preset-hint-item-active", isActive);
      });
      presetHintOverlay.classList.add("preset-hint-overlay-visible");
      clearTimeoutHost.clearTimeout(hidePresetHintTimer);
      hidePresetHintTimer = timeoutHost.setTimeout(function () {
        presetHintOverlay.classList.remove("preset-hint-overlay-visible");
      }, 2000);
    }
  };
}
