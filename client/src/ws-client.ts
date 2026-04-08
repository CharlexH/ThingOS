import type {
  PlaybackDelta,
  PlaybackSnapshot,
  PlaybackStore,
  SettingsResultPayload,
  SettingsStatePayload
} from "./types";

export type ButtonHandler = (button: string) => void;

export interface IncomingMessage {
  type: string;
  data: PlaybackSnapshot | PlaybackDelta | { button: string } | SettingsStatePayload | SettingsResultPayload;
}

export function applyIncomingMessage(
  store: PlaybackStore,
  message: IncomingMessage,
  onButton?: ButtonHandler
): void {
  if (message.type === "state") {
    store.applyState(message.data as PlaybackSnapshot);
  } else if (message.type === "delta") {
    store.applyDelta(message.data as PlaybackDelta);
  } else if (message.type === "settings_state") {
    store.applySettingsState(message.data as SettingsStatePayload);
  } else if (message.type === "settings_result") {
    store.applySettingsResult(message.data as SettingsResultPayload);
  } else if (message.type === "button" && onButton) {
    onButton((message.data as { button: string }).button);
  }
}

export class ThingPlayerSocket {
  private backoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly store: PlaybackStore;
  private socket: WebSocket | null;
  private readonly url: string;
  private buttonHandler: ButtonHandler | null;

  constructor(store: PlaybackStore, url: string) {
    this.backoffMs = 100;
    this.maxBackoffMs = 3000;
    this.socket = null;
    this.store = store;
    this.url = url;
    this.buttonHandler = null;
  }

  onButton(handler: ButtonHandler): void {
    this.buttonHandler = handler;
  }

  connect(): void {
    var socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onmessage = (event: MessageEvent) => {
      var message: IncomingMessage = JSON.parse(event.data);
      applyIncomingMessage(this.store, message, this.buttonHandler ?? undefined);
    };
    socket.onopen = () => {
      this.backoffMs = 100;
    };
    socket.onclose = () => {
      window.setTimeout(() => this.connect(), this.backoffMs);
      this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2);
    };
  }

  sendCommand(action: string, value?: number): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "cmd", action: action, value: value }));
  }

  sendSettingsGet(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "settings_get" }));
  }

  sendSettingsSet(section: string, key: string, value: string | number | boolean): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "settings_set", section: section, key: key, value: value }));
  }

  sendSettingsAction(action: string, params?: Record<string, string>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: "settings_action", action: action, params: params }));
  }
}
