import type { SettingsSectionId, SettingsStatePayload, SettingsViewState } from "../types";

export interface SettingsRenderHandlers {
  openSection(section: SettingsSectionId): void;
  goBack(): void;
  requestState(): void;
  sendSettingsSet(section: string, key: string, value: string | number | boolean): void;
  sendSettingsAction(action: string, params?: Record<string, string>): void;
}

export interface SettingsElements {
  root: HTMLElement;
  header: HTMLElement;
  backButton: HTMLButtonElement;
  title: HTMLElement;
  status: HTMLElement;
  scroll: HTMLElement;
  content: HTMLElement;
}

const HOME_ITEMS: Array<{ section: SettingsSectionId; label: string }> = [
  { section: "bluetooth", label: "Bluetooth" },
  { section: "display", label: "Display" },
  { section: "device", label: "Device" },
  { section: "developer", label: "Developer" }
];

export function createSettingsElements(documentRef: Document, handlers: SettingsRenderHandlers): SettingsElements {
  var root = documentRef.createElement("section");
  var header = documentRef.createElement("div");
  var backButton = documentRef.createElement("button");
  var title = documentRef.createElement("div");
  var status = documentRef.createElement("div");
  var scroll = documentRef.createElement("div");
  var content = documentRef.createElement("div");

  root.className = "settings-screen";
  header.className = "settings-header";
  backButton.className = "settings-back";
  backButton.textContent = "Back";
  title.className = "settings-title";
  status.className = "settings-status";
  scroll.className = "settings-scroll";
  content.className = "settings-content";

  backButton.addEventListener("click", function () {
    handlers.goBack();
  });

  scroll.appendChild(content);
  header.appendChild(backButton);
  header.appendChild(title);
  root.appendChild(header);
  root.appendChild(status);
  root.appendChild(scroll);

  return {
    root: root,
    header: header,
    backButton: backButton,
    title: title,
    status: status,
    scroll: scroll,
    content: content
  };
}

export function scrollSettings(elements: SettingsElements, delta: number): void {
  elements.scroll.scrollTop += delta;
}

export function renderSettings(
  documentRef: Document,
  elements: SettingsElements,
  settings: SettingsViewState,
  handlers: SettingsRenderHandlers
): void {
  var section = settings.section;
  var data = settings.data;

  elements.backButton.hidden = section === "home";
  elements.title.textContent = titleForSection(section);
  elements.status.textContent = renderStatusText(settings);
  elements.status.hidden = !elements.status.textContent;

  clearElement(elements.content);

  if (section === "home") {
    HOME_ITEMS.forEach(function (item) {
      var button = documentRef.createElement("button");
      button.className = "settings-home-item";
      button.textContent = item.label;
      button.addEventListener("click", function () {
        handlers.openSection(item.section);
      });
      elements.content.appendChild(button);
    });
    return;
  }

  if (section === "bluetooth") {
    renderBluetoothSection(documentRef, elements.content, data, handlers);
    return;
  }
  if (section === "display") {
    renderDisplaySection(documentRef, elements.content, data, handlers);
    return;
  }
  if (section === "device") {
    renderDeviceSection(documentRef, elements.content, data);
    return;
  }
  renderDeveloperSection(documentRef, elements.content, data, handlers);
}

function renderStatusText(settings: SettingsViewState): string {
  if (settings.loading) {
    return "Working...";
  }
  if (settings.actionStatus.kind === "success" || settings.actionStatus.kind === "error") {
    return settings.actionStatus.message;
  }
  return "";
}

function renderBluetoothSection(
  documentRef: Document,
  container: HTMLElement,
  data: SettingsStatePayload | null,
  handlers: SettingsRenderHandlers
): void {
  appendKeyValue(documentRef, container, "Bluetooth", data?.bluetooth.enabled ? "On" : "Off");
  appendKeyValue(documentRef, container, "Scanning", data?.bluetooth.discovering ? "Yes" : "No");
  appendActionButton(documentRef, container, "Refresh", function () {
    handlers.requestState();
  });
  appendActionButton(documentRef, container, "Scan for devices", function () {
    handlers.sendSettingsAction("bluetooth_scan");
  });
  appendDeviceGroup(documentRef, container, "Paired devices", data?.bluetooth.pairedDevices || [], handlers);
  appendDeviceGroup(documentRef, container, "Available devices", data?.bluetooth.scannedDevices || [], handlers);
}

function renderDisplaySection(
  documentRef: Document,
  container: HTMLElement,
  data: SettingsStatePayload | null,
  handlers: SettingsRenderHandlers
): void {
  var display = data?.display;
  var brightness = display?.brightness ?? 0;
  var maxBrightness = display?.maxBrightness ?? 255;
  var row = documentRef.createElement("div");
  var label = documentRef.createElement("div");
  var value = documentRef.createElement("div");
  var slider = documentRef.createElement("input");

  row.className = "settings-slider-row";
  label.className = "settings-label";
  value.className = "settings-value";
  label.textContent = "Brightness";
  value.textContent = String(brightness);
  slider.className = "settings-slider";
  slider.type = "range";
  slider.min = "0";
  slider.max = String(maxBrightness);
  slider.value = String(brightness);
  slider.addEventListener("input", function () {
    value.textContent = slider.value;
  });
  slider.addEventListener("change", function () {
    handlers.sendSettingsSet("display", "brightness", Number(slider.value));
  });
  row.appendChild(label);
  row.appendChild(value);
  container.appendChild(row);
  container.appendChild(slider);

  appendActionButton(
    documentRef,
    container,
    display?.autoBrightness ? "Auto brightness: On" : "Auto brightness: Off",
    function () {
      handlers.sendSettingsSet("display", "autoBrightness", !(display?.autoBrightness ?? false));
    }
  );
  appendKeyValue(
    documentRef,
    container,
    "Ambient light",
    display?.ambientLux === null || display?.ambientLux === undefined ? "--" : String(display.ambientLux)
  );
}

function renderDeviceSection(
  documentRef: Document,
  container: HTMLElement,
  data: SettingsStatePayload | null
): void {
  appendKeyValue(documentRef, container, "Model", data?.device.model || "--");
  appendKeyValue(documentRef, container, "System", data?.device.systemVersion || "--");
  appendKeyValue(documentRef, container, "Serial", data?.device.serial || "--");
  appendKeyValue(documentRef, container, "IP", data?.device.ipAddress || "--");
  appendKeyValue(documentRef, container, "ADB", data?.device.adbConnected ? "Connected" : "Disconnected");
  appendKeyValue(documentRef, container, "WebSocket", data?.device.wsConnected ? "Connected" : "Disconnected");
}

function renderDeveloperSection(
  documentRef: Document,
  container: HTMLElement,
  data: SettingsStatePayload | null,
  handlers: SettingsRenderHandlers
): void {
  appendKeyValue(documentRef, container, "ADB", data?.developer.adbConnected ? "Connected" : "Disconnected");
  appendKeyValue(
    documentRef,
    container,
    "Reverse ports",
    data?.developer.reversePorts.length ? data.developer.reversePorts.join(", ") : "--"
  );
  appendKeyValue(
    documentRef,
    container,
    "Bluetooth daemon",
    data?.developer.bluetoothDaemonRunning ? "Running" : "Stopped"
  );
  appendActionButton(documentRef, container, "Recreate reverse ports", function () {
    handlers.sendSettingsAction("recreate_reverse_ports");
  });
  appendActionButton(documentRef, container, "Restart Chromium", function () {
    handlers.sendSettingsAction("restart_chromium");
  });
  appendActionButton(documentRef, container, "Reload frontend", function () {
    handlers.sendSettingsAction("reload_frontend");
  });
}

function appendDeviceGroup(
  documentRef: Document,
  container: HTMLElement,
  title: string,
  devices: Array<{ id: string; name: string; paired: boolean; connected: boolean }>,
  handlers: SettingsRenderHandlers
): void {
  var heading = documentRef.createElement("div");
  heading.className = "settings-group-title";
  heading.textContent = title;
  container.appendChild(heading);

  if (!devices.length) {
    appendKeyValue(documentRef, container, title, "--");
    return;
  }

  devices.forEach(function (device) {
    var row = documentRef.createElement("div");
    var name = documentRef.createElement("div");
    var actions = documentRef.createElement("div");

    row.className = "settings-device-row";
    name.className = "settings-device-name";
    actions.className = "settings-device-actions";
    name.textContent = device.name + " (" + device.id + ")";
    row.appendChild(name);

    if (device.connected) {
      actions.appendChild(
        makeActionButton(documentRef, "Disconnect", function () {
          handlers.sendSettingsAction("bluetooth_disconnect", { id: device.id });
        })
      );
    } else if (device.paired) {
      actions.appendChild(
        makeActionButton(documentRef, "Connect", function () {
          handlers.sendSettingsAction("bluetooth_connect", { id: device.id });
        })
      );
      actions.appendChild(
        makeActionButton(documentRef, "Forget", function () {
          handlers.sendSettingsAction("bluetooth_forget", { id: device.id });
        })
      );
    } else {
      actions.appendChild(
        makeActionButton(documentRef, "Pair", function () {
          handlers.sendSettingsAction("bluetooth_pair_connect", { id: device.id });
        })
      );
    }
    row.appendChild(actions);
    container.appendChild(row);
  });
}

function appendKeyValue(documentRef: Document, container: HTMLElement, label: string, value: string): void {
  var row = documentRef.createElement("div");
  var name = documentRef.createElement("div");
  var text = documentRef.createElement("div");

  row.className = "settings-row";
  name.className = "settings-label";
  text.className = "settings-value";
  name.textContent = label;
  text.textContent = value;
  row.appendChild(name);
  row.appendChild(text);
  container.appendChild(row);
}

function appendActionButton(
  documentRef: Document,
  container: HTMLElement,
  label: string,
  onClick: () => void
): void {
  container.appendChild(makeActionButton(documentRef, label, onClick));
}

function makeActionButton(documentRef: Document, label: string, onClick: () => void): HTMLButtonElement {
  var button = documentRef.createElement("button");
  button.className = "settings-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function titleForSection(section: SettingsSectionId): string {
  if (section === "home") {
    return "Settings";
  }
  return HOME_ITEMS.filter(function (item) {
    return item.section === section;
  })[0].label;
}

function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
