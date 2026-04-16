export type PlaybackStatus =
  | "ok"
  | "idle"
  | "spotify_not_running"
  | "no_track"
  | "error";

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  track: string;
  artist: string;
  album: string;
  artworkUrl: string;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  connected: boolean;
  ts: number;
  serverTimeMs?: number;
  serverTimezoneOffsetMinutes?: number;
}

export interface PlaybackDelta {
  position: number;
  ts: number;
}

export type AppId = "spotify" | "home" | "magi" | "settings";

export type HomeMode = "clock" | "timer_set" | "timer_running" | "timer_paused" | "timer_done";

export interface HomeTimerState {
  mode: HomeMode;
  setSeconds: number;
  remainingMs: number;
  anchorMs: number;
  anchorRemaining: number;
  flashUntilMs: number;
}

export type SettingsSectionId = "home" | "bluetooth" | "display" | "device" | "developer";

export interface SettingsBluetoothDevice {
  id: string;
  name: string;
  paired: boolean;
  connected: boolean;
  trusted: boolean;
}

export interface SettingsStatePayload {
  bluetooth: {
    enabled: boolean;
    discovering: boolean;
    pairedDevices: SettingsBluetoothDevice[];
    scannedDevices: SettingsBluetoothDevice[];
  };
  display: {
    brightness: number;
    maxBrightness: number;
    autoBrightness: boolean;
    ambientLux: number | null;
  };
  device: {
    model: string;
    systemVersion: string;
    serial: string;
    ipAddress: string;
    adbConnected: boolean;
    wsConnected: boolean;
  };
  developer: {
    adbConnected: boolean;
    reversePorts: string[];
    bluetoothDaemonRunning: boolean;
  };
}

export interface SettingsResultPayload {
  ok: boolean;
  action: string;
  message: string;
}

export interface SettingsActionStatus {
  kind: "idle" | "loading" | "success" | "error";
  action: string;
  message: string;
}

export interface SettingsViewState {
  section: SettingsSectionId;
  data: SettingsStatePayload | null;
  loading: boolean;
  actionStatus: SettingsActionStatus;
}

export interface ClockAnchor {
  serverTimeMs: number;
  receivedAtMs: number;
  timezoneOffsetMinutes: number;
}

export interface PlaybackStoreState {
  current: PlaybackSnapshot;
  display: PlaybackSnapshot;
  status: PlaybackStatus;
  progressAnchorTs: number;
  activeApp: AppId;
  clockAnchor: ClockAnchor;
  homeTimer: HomeTimerState;
  settings: SettingsViewState;
}

export interface PlaybackStore {
  applyState(snapshot: PlaybackSnapshot): void;
  applyDelta(delta: PlaybackDelta): void;
  applySettingsState(snapshot: SettingsStatePayload): void;
  applySettingsResult(result: SettingsResultPayload): void;
  beginSettingsAction(action: string): void;
  switchApp(app: AppId): void;
  switchSettingsSection(section: SettingsSectionId): void;
  timerAdjust(deltaSec: number): void;
  timerStart(): void;
  timerPause(): void;
  timerResume(): void;
  timerDone(): void;
  timerReset(): void;
  timerExit(): void;
  getState(): PlaybackStoreState;
  subscribe(listener: (state: PlaybackStoreState) => void): () => void;
}
