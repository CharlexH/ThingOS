import type { ClockAnchor, HomeTimerState } from "../types";

export interface HomeClockElements {
  root: HTMLElement;
  wrapper: HTMLElement;
  hours: HTMLElement;
  colon: HTMLElement;
  minutes: HTMLElement;
  date: HTMLElement;
}

export function createHomeClockElements(documentRef: Document): HomeClockElements {
  var root = documentRef.createElement("section");
  var wrapper = documentRef.createElement("div");
  var time = documentRef.createElement("div");
  var hours = documentRef.createElement("span");
  var colon = documentRef.createElement("span");
  var minutes = documentRef.createElement("span");
  var date = documentRef.createElement("div");

  root.className = "home-screen";
  wrapper.className = "home-clock-wrapper";
  time.className = "home-clock-time";
  colon.className = "home-clock-colon";
  date.className = "home-clock-date";

  time.appendChild(hours);
  time.appendChild(colon);
  time.appendChild(minutes);
  wrapper.appendChild(time);
  wrapper.appendChild(date);
  root.appendChild(wrapper);

  colon.textContent = ":";

  return {
    root: root,
    wrapper: wrapper,
    hours: hours,
    colon: colon,
    minutes: minutes,
    date: date
  };
}

var DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

var SUBTITLE_MAP: Record<string, string> = {
  "set:work": "COUNTDOWN",
  "set:rest": "REST",
  "running:work": "WORKING",
  "running:rest": "RESTING",
  "paused:work": "PAUSED",
  "paused:rest": "PAUSED",
  "done": "TIME\u2019S UP",
  "flashing": "TIME\u2019S UP"
};

export function formatClockParts(anchor: ClockAnchor, nowMs: number): { hours: string; minutes: string; day: string; num: string; month: string } {
  if (!anchor.serverTimeMs) {
    return { hours: "--", minutes: "--", day: "", num: "", month: "" };
  }

  var currentMs =
    anchor.serverTimeMs +
    Math.max(0, nowMs - anchor.receivedAtMs) +
    anchor.timezoneOffsetMinutes * 60 * 1000;
  var d = new Date(currentMs);

  return {
    hours: String(d.getUTCHours()).padStart(2, "0"),
    minutes: String(d.getUTCMinutes()).padStart(2, "0"),
    day: DAYS[d.getUTCDay()],
    num: String(d.getUTCDate()),
    month: MONTHS[d.getUTCMonth()]
  };
}

export function formatClockTime(anchor: ClockAnchor, nowMs: number = Date.now()): string {
  var p = formatClockParts(anchor, nowMs);
  return p.hours + ":" + p.minutes;
}

function formatTimerMs(ms: number): { mm: string; ss: string } {
  var totalSec = Math.max(0, Math.ceil(ms / 1000));
  var mm = Math.floor(totalSec / 60);
  var ss = totalSec % 60;
  return {
    mm: String(mm).padStart(2, "0"),
    ss: String(ss).padStart(2, "0")
  };
}

function getRunningRemaining(timer: HomeTimerState, nowMs: number): number {
  return Math.max(0, timer.anchorRemaining - Math.max(0, nowMs - timer.anchorMs));
}

function getDisplayMs(timer: HomeTimerState, nowMs: number): number {
  if (timer.mode === "flashing") {
    return 0;
  }
  if (timer.mode === "done") {
    return 0;
  }
  if (timer.mode === "set") {
    return (timer.settingTarget === "rest" ? timer.restSeconds : timer.workSeconds) * 1000;
  }
  if (timer.mode === "running") {
    return getRunningRemaining(timer, nowMs);
  }
  return timer.remainingMs;
}

function getSubtitle(timer: HomeTimerState): string {
  if (timer.mode === "done") {
    return SUBTITLE_MAP.done;
  }
  if (timer.mode === "flashing") {
    return SUBTITLE_MAP.flashing;
  }
  if (timer.mode === "set") {
    return SUBTITLE_MAP["set:" + timer.settingTarget];
  }
  return SUBTITLE_MAP[timer.mode + ":" + timer.phase] || "";
}

function applyThemeClasses(elements: HomeClockElements, timer: HomeTimerState): void {
  var isResting =
    (timer.mode === "running" || timer.mode === "paused") &&
    timer.phase === "rest";
  var isCountdownSetup = timer.mode === "set" && timer.settingTarget === "work";
  var isRestSetup = timer.mode === "set" && timer.settingTarget === "rest";
  var isWorking = timer.mode === "running" && timer.phase === "work";

  elements.root.classList.toggle("home-screen-resting", isResting);
  elements.date.classList.toggle("home-clock-date-countdown", isCountdownSetup);
  elements.date.classList.toggle("home-clock-date-rest", isRestSetup);
  elements.date.classList.toggle("home-clock-date-working", isWorking);
}

function applyFlashClasses(elements: HomeClockElements, timer: HomeTimerState, nowMs: number): void {
  elements.root.classList.remove("home-clock-flash-white");
  elements.root.classList.remove("home-clock-flash-green");

  if (timer.flashKind === "none" || timer.flashUntilMs <= nowMs) {
    return;
  }

  var phase = Math.floor((timer.flashUntilMs - nowMs) / 250) % 2;
  if (timer.flashKind === "rest_done") {
    elements.root.classList.add(phase === 0 ? "home-clock-flash-green" : "home-clock-flash-white");
    return;
  }

  if (phase === 0) {
    elements.root.classList.add("home-clock-flash-white");
  }
}

export function renderHomeClock(
  elements: HomeClockElements,
  anchor: ClockAnchor,
  timer: HomeTimerState
): void {
  var now = Date.now();

  applyThemeClasses(elements, timer);
  applyFlashClasses(elements, timer, now);

  if (timer.mode === "clock") {
    elements.colon.classList.add("home-clock-colon-blink");
    var parts = formatClockParts(anchor, now);

    if (elements.hours.textContent !== parts.hours) {
      elements.hours.textContent = parts.hours;
    }
    if (elements.minutes.textContent !== parts.minutes) {
      elements.minutes.textContent = parts.minutes;
    }
    var dateText = parts.day + " \u00b7 " + parts.num + " \u00b7 " + parts.month;
    if (elements.date.textContent !== dateText) {
      elements.date.textContent = dateText;
    }
    return;
  }

  elements.colon.classList.toggle("home-clock-colon-blink", timer.mode === "running");

  var remaining = getDisplayMs(timer, now);
  var t = formatTimerMs(remaining);

  if (elements.hours.textContent !== t.mm) {
    elements.hours.textContent = t.mm;
  }
  if (elements.minutes.textContent !== t.ss) {
    elements.minutes.textContent = t.ss;
  }

  var subtitle = getSubtitle(timer);
  if (elements.date.textContent !== subtitle) {
    elements.date.textContent = subtitle;
  }
}
