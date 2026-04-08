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

function getTimerRemaining(timer: HomeTimerState, nowMs: number): number {
  if (timer.mode === "timer_running") {
    var elapsed = nowMs - timer.anchorMs;
    return Math.max(0, timer.anchorRemaining - elapsed);
  }
  return timer.remainingMs;
}

var SUBTITLE_MAP: Record<string, string> = {
  "timer_set": "COUNTDOWN",
  "timer_running": "COUNTDOWN",
  "timer_paused": "PAUSED",
  "timer_done": "TIME\u2019S UP"
};

export function renderHomeClock(
  elements: HomeClockElements,
  anchor: ClockAnchor,
  timer: HomeTimerState
): void {
  var now = Date.now();

  // Flash effect
  var isFlashing = timer.flashUntilMs > now;
  if (isFlashing) {
    var phase = Math.floor((timer.flashUntilMs - now) / 250) % 2;
    elements.root.classList.toggle("home-clock-flash-white", phase === 0);
  } else {
    elements.root.classList.remove("home-clock-flash-white");
  }

  if (timer.mode === "clock") {
    // Clock mode
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

  // Timer modes
  elements.colon.classList.toggle("home-clock-colon-blink", timer.mode === "timer_running");

  var remaining: number;
  if (isFlashing) {
    remaining = 0;
  } else if (timer.mode === "timer_done") {
    remaining = timer.setSeconds * 1000;
  } else {
    remaining = getTimerRemaining(timer, now);
  }

  var t = formatTimerMs(remaining);

  if (elements.hours.textContent !== t.mm) {
    elements.hours.textContent = t.mm;
  }
  if (elements.minutes.textContent !== t.ss) {
    elements.minutes.textContent = t.ss;
  }

  var subtitle = isFlashing ? "TIME\u2019S UP" : (SUBTITLE_MAP[timer.mode] || "");
  if (elements.date.textContent !== subtitle) {
    elements.date.textContent = subtitle;
  }
}
