# MAGI Harness Console — Product / Interaction Design

> **Status:** Planning phase. UI concept only. Backing harness data is mocked.
> **Scope:** A new CarThing "app" bound to top physical preset button #3 (`preset3`),
> presenting an AI design-harness workflow monitor inspired by EVA / MAGI but
> designed as a credible agentic-workflow console — not fan art.
>
> **Follow-up:** Once this design is approved, a separate TDD implementation plan
> will be written under `docs/plans/2026-04-15-magi-harness-console-plan.md`.

---

## 0. Context & constraints

- **Device:** CarThing, 800×480 landscape, one scroll wheel, one knob press,
  one back button, four top preset buttons.
- **Current button map:** `preset1→spotify`, `preset2→home`, `preset3→home`,
  `preset4→settings` (see [client/src/app-switching.ts](../../client/src/app-switching.ts)).
- **Change introduced by this feature:** `preset3` is repurposed to a new app
  id `magi`. `preset2` remains the sole Home shortcut. No other buttons change.
- **App-shell pattern:** Existing `AppId` union + `switchApp(app)` +
  renderer dispatch (see [client/src/state.ts](../../client/src/state.ts),
  [client/src/ui/renderer.ts](../../client/src/ui/renderer.ts)).
- **Data source for this milestone:** Front-end mock only — no new WS message
  types, no server-side harness. Mock data lives in a deterministic module
  so the console feels alive (ticks forward, state transitions occur) without
  requiring any backend.
- **Language:** UI strings are a mix of Japanese kanji tokens (状态徽标) and
  English technical labels — matches the reference Figma. Must be compatible
  with the existing `i18n.ts` plumbing but most tokens here are intentionally
  kanji-as-icons rather than translatable copy.

---

## 1. Screen role

### Product role
The MAGI console is a **workflow monitor** for a long-running agentic design
task. Its job is to tell the operator, at a glance:

1. Is the overall task running, stalled, waiting for me, or done?
2. Which of the three stages (Planning / Execution / Evaluation) is active,
   and how far along is it?
3. Has any stage been rejected (`否定`) and why?
4. Is the underlying system (model link, platform) healthy?
5. Which model backend is currently driving this run (Claude vs Codex)?

### First-glance impression
Within the first ~2 seconds, the user should read the screen as:
"**Task X is in stage Y, stage Y is Z% done, overall status is W, system is
healthy / degraded.**" Everything else is supporting detail.

### What it is NOT
- Not a chat UI. No free-form conversation.
- Not a result viewer. The actual design artifacts live elsewhere.
- Not an editor. The operator does not author the plan on this screen.
- Not a dashboard with KPI tiles. It has one subject: the current run.

---

## 2. Information architecture

Six always-on zones plus one on-demand overlay. Each has one job. The central
hexagon cluster is the hero; every other zone either gives it context or tells
you something the hexagons can't.

### A. Top-right — Global task status badge
- **Shows:** one of `待機 / 審議中 / 再審中 / 介入要請 / 決議終了 / 異常停止`.
- **Semantics:** the *single source of truth* for "what's happening at the
  workflow level right now." Every other zone must be consistent with it.
- **Why it lives here:** top-right is the universal "status" position in
  console UIs; the eye lands here after the hexagons.

### B. Center — Three-hexagon stage cluster
- **Shows:** Planning (MELCHIOR / #1), Execution (BALTHASAR / #2),
  Evaluation (CASPER / #3).
- **Per hexagon:** numeric label, codename, live progress fill, optional
  verdict stamp (`承認` / `否定`), and an active/inactive visual weight.
- **Semantics:** stage-level truth. A hexagon's state must never contradict
  the global badge (see State Logic §3.4 for the mapping rule).
- **Note on naming:** MELCHIOR/BALTHASAR/CASPER are the three MAGI
  supercomputers. Assigning them to Planning/Execution/Evaluation is a
  deliberate mapping (MELCHIOR = scientist/planner, BALTHASAR = mother/doer,
  CASPER = woman/critic). Do not reshuffle without a reason — the mapping
  becomes muscle memory for repeat users.

### C. Left — Focused-stage intelligence panel
- **Shows:** for the currently focused stage only, a structured readout:
  - `TASK` — current sub-task name
  - `SOURCE` — input artifact (`PRD`, `FIGMA_FRAME`, `PROTOTYPE_V2`, …)
  - `HANDOFF` — integer, how many times this stage handed off to itself
    or an adjacent stage (proxy for "how hard is this run fighting back")
  - `CONF` — confidence band (`LOW` / `MED` / `HIGH`) — *band, not a percent*,
    to avoid false precision
  - 2–4 lines of stage-specific dynamic summary (see §5 for content)
- **Semantics:** "why is the active hexagon in the state it's in."
- **Focus rule:** this panel always mirrors the *focused* hexagon, which may
  or may not be the *active* hexagon (see Interaction Logic §4.1).

### D. Bottom — Workflow timeline / overall progress
- **Shows:** a three-segment horizontal bar, one segment per stage, each
  segment independently fillable. A caret / marker indicates the currently
  active stage.
- **Additional signals:**
  - If a stage was `否定`'d and re-entered, its segment shows a "rework"
    pattern (e.g., hatched fill) rather than being reset to empty — this
    carries history, which matters for trust.
  - Overall left-to-right reading equals Planning → Execution → Evaluation.
- **Semantics:** temporal truth across the whole run. The hexagons show
  "now per stage"; this bar shows "the whole journey."

### E. Bottom-left — System health
- **Shows:** one of `ONLINE / STABLE / DEGRADED / RELINK / OFFLINE`.
- **Semantics:** platform/link health, *not* task health. A task can be
  `審議中` while the system is `DEGRADED`; both are true simultaneously.
- **Interaction rule:** if this zone goes `OFFLINE` or `RELINK`, the central
  hexagon cluster must visibly pause (see §6) — otherwise the console lies.

### F. Bottom-right — Model type (wheel-controlled)
- **Shows:** `TYPE / CLD` or `TYPE / CDX`, rendered with the Figma glyph
  styling (treated as a glyph token, not translatable text).
- **Semantics:** which model backend is currently driving the run.
- **Input:** the scroll wheel toggles between the two values (§4.1).
- **Scope:** UI-only in v1. Toggling TYPE does **not** affect any run state
  — the mock keeps running whatever it's running. In a future version this
  field will drive real backend routing; the state machine is intentionally
  decoupled so that change is additive.
- **Compact, one line.** No logo, no version number on this screen (noise).
  Version detail belongs in Settings if needed later.

### G. Overlay — Voice-input mock (on-demand)
- **Shows:** a Typeless-style voice-input terminal that appears on top of
  the console when invoked (triggered by the back button — see §4.1).
- **Purpose:** lets the operator "speak a brief" to the harness in a
  vibecoding flow. In v1 this is fully mocked: no mic access, no real
  transcription; a pre-scripted transcript types itself out with a
  waveform-style indicator.
- **Shape:** full-width bottom drawer (roughly the lower 40% of the screen)
  with a prominent waveform/indicator bar, a live-transcribing text line,
  and a one-line hint for controls. Does not obscure the global status
  badge (zone A) — the operator must still see the workflow state.
- **Lifecycle:** entered via back button; dismissed via back button or
  knob press (see §4.7).
- **Scope:** UI-only. Nothing downstream actually consumes the mock
  transcript in v1; committing the transcript appends a fake line to the
  currently-active stage's summary in zone C so the interaction *reads*
  as connected.

### Optional header strip (top-left, already in Figma)
- Session id (`MAGI DESIGN HARNESS 01`), access mode (`SUPERVISER`).
- Fixed text for the first milestone. Wire up to real values later.

---

## 3. State logic

This section is the product-logic contract. Visual choices in §6 must respect
these rules; they do not override them.

### 3.1 Global task status — state machine

States: `IDLE (待機) / RUNNING (審議中) / REWORK (再審中) / INTERVENTION (介入要請) / DONE (決議終了) / HALTED (異常停止)`.

Transitions (only these are legal):

| From              | Event                                                   | To             |
|-------------------|---------------------------------------------------------|----------------|
| `IDLE`            | run started                                             | `RUNNING`      |
| `RUNNING`         | Evaluation verdict = `承認`                             | `DONE`         |
| `RUNNING`         | Evaluation verdict = `否定`, severity ≤ `MEDIUM`        | `REWORK`       |
| `RUNNING`         | Evaluation verdict = `否定`, severity = `HIGH`          | `INTERVENTION` |
| `RUNNING`         | any stage raises unrecoverable error                    | `HALTED`       |
| `REWORK`          | rework loop completes, new Evaluation = `承認`          | `DONE`         |
| `REWORK`          | rework loop hits retry cap without `承認`               | `INTERVENTION` |
| `INTERVENTION`    | operator resolves (resume / edit / abort)               | `RUNNING` or `HALTED` |
| `DONE` / `HALTED` | operator starts new run                                 | `RUNNING`      |

**Invariants:**
- Only Evaluation can push the run to `DONE` or directly to `REWORK`.
- `INTERVENTION` is always reachable from any non-terminal state in principle,
  but in this milestone it is only entered via the two rules above.
- `HALTED` is terminal from the console's POV; recovery is a new run.

### 3.2 Per-stage progress

Each hexagon has an internal progress value `0.0 – 1.0` and a verdict:
`NONE | 承認 | 否定`.

- Progress **only increases** while a stage is active. It does not decay.
- On stage entry, progress resets to `0.0` and verdict resets to `NONE`.
- On rework re-entry, progress resets to `0.0` but the **timeline segment**
  (zone D) keeps a "rework" visual so history isn't erased.

### 3.3 Stage lifecycle

For each stage:
1. `PENDING` (not yet reached)
2. `ACTIVE` (progress animating, verdict = `NONE`)
3. `STAMPED` (progress = `1.0`, verdict in `{承認, 否定}`)
4. `PENDING_REWORK` (only Evaluation: verdict = `否定`, waiting for
   upstream re-entry)

A stage never goes backwards on its own; it re-enters via the global rework
flow.

### 3.4 Global-vs-stage consistency rules

These are the rules that stop the UI from lying:

1. If **any** hexagon is `ACTIVE`, global must be `RUNNING` or `REWORK`.
2. If all three hexagons are `STAMPED` with `承認`, global must be `DONE`.
3. If Evaluation is `STAMPED` with `否定`, global must be `REWORK` or
   `INTERVENTION` — never `RUNNING`.
4. If global is `IDLE`, all hexagons are `PENDING` and timeline is empty.
5. If global is `HALTED`, the currently-active hexagon freezes mid-progress
   and shows a halt overlay; verdict is not stamped.

### 3.5 Verdict severity → next global state

When Evaluation stamps `否定`, the mock also emits a severity:
- `LOW` (minor rubric miss) → unused in v1 (treated as `MEDIUM`)
- `MEDIUM` → `REWORK`, retry counter +1
- `HIGH` → `INTERVENTION` immediately

`REWORK` retry cap = **2**. Third `否定` in a row → `INTERVENTION`.

### 3.6 Intervention resolution (v1, mocked)

In v1 the operator cannot truly resolve intervention from the CarThing (no
text input). The console exposes three knob-mediated choices:
`RESUME / ABORT / DEFER`. `RESUME` re-enters the last rejected stage;
`ABORT` → `HALTED`; `DEFER` → keeps `INTERVENTION` and exits the app (the
mock will happily sit there).

---

## 4. Interaction logic

### 4.1 Input mapping (v1)

MAGI deliberately uses a **minimal, non-overlapping** input vocabulary.
There is no user-driven focus cursor; the left panel always mirrors the
active stage (see §4.2).

| Input           | Function in MAGI                                             |
|-----------------|--------------------------------------------------------------|
| Scroll wheel    | Toggle `TYPE` between `CLD` and `CDX` (zone F).              |
| Knob press      | Primary action: start run (when `IDLE`), pause / resume      |
|                 | (when active), confirm selection (when in intervention).     |
| Back button     | Open the voice-input mock overlay (§4.7). Not "exit app."    |
| Touchscreen     | No-op in v1. Reserved.                                       |
| `preset1/2/4`   | Switch to the corresponding app (standard global shortcut).  |
|                 | This is how the operator **exits** MAGI.                     |
| `preset3`       | Enter MAGI from anywhere. No-op when already in MAGI.        |

**Important divergences from the rest of the app:**

- **Back does not exit.** Everywhere else in ThingPlayer, Back is
  "go back / leave the current context." Inside MAGI, Back opens voice
  input. Exiting MAGI is exclusively via the preset buttons. This must be
  called out in release notes and covered by the input-routing tests so it
  doesn't silently regress.
- **Scroll wheel does not adjust volume or timers here.** While MAGI is
  the active app, wheel events are consumed by the TYPE toggle only.
- **Touch is ignored.** The renderer must not silently accept taps as
  "activate the hexagon under my finger" etc. — failing closed on touch
  keeps the interaction model honest until we design touch properly.

### 4.2 Left panel follows active stage

Zone C always mirrors the **active** stage — the stage the harness is
currently working on. There is no user-driven focus concept in v1; the
panel updates automatically as the run progresses.

When the active stage changes, the panel's contents swap with a short
crossfade. The panel header always carries the stage name so there is no
ambiguity during the transition.

When global is `IDLE` (run not started), the panel shows a sparse
"waiting for run to start — press knob to begin" placeholder. It never
shows stale data from a prior run and never shows a blank box.

### 4.3 Stage completion flow

When the active stage hits progress `1.0`:
1. Hexagon fill locks at full.
2. Verdict stamp appears with a short settle animation (see §6).
3. Corresponding bottom-timeline segment locks to full.
4. If stage was Planning/Execution and verdict = `承認`, active stage
   advances; caret moves on the timeline; focus follows active unless the
   user has pinned it elsewhere.
5. If stage was Evaluation, global transitions per §3.1.

### 4.4 Evaluation = `否定` flow

1. CASPER stamps `否定`.
2. Global transitions to `REWORK` (MEDIUM) or `INTERVENTION` (HIGH).
3. In `REWORK`: the rejected upstream stage (Planning or Execution,
   depending on what the rubric cites) becomes active again; its hexagon
   re-enters `ACTIVE` with progress `0.0`; timeline segment switches to
   rework pattern; left panel updates to the upstream stage's context
   including a `REWORK REASON` line quoting the rubric.
4. In `INTERVENTION`: all hexagon progress animation pauses; global badge
   pulses (§6); left panel switches to a compact intervention panel
   offering `RESUME / ABORT / DEFER` navigable via wheel + knob press.

### 4.5 Human-intervention flow

- Global badge is the highest-priority visual signal in the screen.
- Right-upper badge pulses (low-frequency, not seizure-inducing).
- System health zone is *not* repurposed to convey intervention — the two
  are independent.
- Exiting the app and returning later must preserve the intervention state
  exactly; the harness doesn't auto-resolve in the background.

### 4.6 System-health interactions

- `DEGRADED` / `RELINK`: central cluster visually dims slightly, but
  progress continues (mock keeps ticking; in real life the harness decides).
- `OFFLINE`: progress pauses, a subtle overlay marks the cluster as stale.
  Global badge is *not* forced to `HALTED`; offline ≠ halted.

### 4.7 Voice-input overlay flow

Purpose: a vibecoding-style dictation entry point. Triggered by back button.

1. **Enter.** Back button while MAGI is active → voice overlay slides up
   from the bottom. The underlying console keeps running (progress keeps
   advancing; global badge remains readable above the drawer). The run is
   not paused by opening the overlay.
2. **Active dictation (mocked).** A pre-scripted transcript types itself
   out over ~4–6 seconds with a simple waveform/indicator animation.
   There is no real mic access. The hint line reads something like
   `KNOB: COMMIT   BACK: CANCEL`.
3. **Commit.** Knob press → overlay closes with a short confirm animation;
   a new line is appended to the active stage's summary in zone C (e.g.,
   `VOICE: "tighten evaluation rubric around state coverage"`). Run state
   is otherwise untouched in v1 — the transcript is not actually fed into
   the harness.
4. **Cancel.** Back button (again) → overlay dismisses with no change
   to zone C.
5. **Re-entry.** Pressing back immediately after commit/cancel reopens the
   overlay with a fresh scripted transcript (see §5.10 for transcripts).

**Non-goals for v1:**
- No real speech recognition.
- No editable transcript.
- No branching behaviour based on transcript contents.
- The overlay does not block preset buttons — pressing `preset1/2/4`
  while the overlay is open still switches apps and implicitly dismisses
  the overlay.

---

## 5. Mock data recommendation

The mock should be a **scripted run** that hits every interesting state at
least once, cycles on a realistic cadence, and feels like a real harness.
Goal: an observer leaving the device on for a minute or two should see
Planning succeed, Execution succeed, Evaluation reject once, the system
enter `再審中`, the rework succeed, and the run reach `決議終了`.

### 5.1 Shared run metadata

```
RUN_ID        : RUN-2026-04-15-014
SESSION       : MAGI DESIGN HARNESS 01
ACCESS        : SUPERVISER
MODEL_BACKEND : CLD          # toggled via a debug flag to CDX for demo
SYSTEM_HEALTH : ONLINE → STABLE (most of the run)
```

### 5.2 Planning (MELCHIOR)

```
TASK     : PLANNING
SOURCE   : PRD
HANDOFF  : 0 → 1 → 3
CONF     : HIGH
SUMMARY  :
  - PARSED   : 1× PRD, 1× BRIEF
  - EXTRACTED: 14 REQUIREMENTS, 4 CONSTRAINTS
  - DRAFTED  : 3 ALT FLOWS, 1 SELECTED
  - RISKS    : 2 OPEN (AUTH, OFFLINE)
VERDICT  : 承認
DURATION : ~25s (mock)
```

Interesting transitions for the scripted run:
- `HANDOFF` ticks from 0 to 3 as it bounces internally before stamping.
- `CONF` briefly drops to `MED` mid-run then recovers — proves the field
  isn't cosmetic.

### 5.3 Execution (BALTHASAR)

```
TASK     : EXECUTION
SOURCE   : PLAN_V1
HANDOFF  : 0 → 2
CONF     : MED
SUMMARY  :
  - BUILT     : FRAME 04 / 12
  - COMPONENT : HEX_CLUSTER, STATUS_BADGE
  - TOKENS    : 42 APPLIED
  - PENDING   : 1 MOTION SPEC
VERDICT  : 承認
DURATION : ~40s (mock)
```

Notes:
- Progress fill is not linear. It should have one or two "thinking" plateaus
  where progress sits at ~35% and ~70% for a few seconds; otherwise progress
  feels like a fake loading bar.

### 5.4 Evaluation (CASPER) — first pass

```
TASK     : EVALUATION
SOURCE   : PROTOTYPE_V1
HANDOFF  : 0 → 1
CONF     : LOW
RUBRIC   :
  - CLARITY      : PASS
  - HIERARCHY    : PASS
  - STATE_COVER  : FAIL  (empty/loading/error missing on HEX_CLUSTER)
  - ACCESSIBILITY: PASS
ISSUES   : 1 HIGH-SEV UX GAP
VERDICT  : 否定   (severity: MEDIUM)
REASON   : STATE_COVER incomplete — rework BALTHASAR
```

Global: → `再審中`. Timeline: Execution segment flips to rework pattern.
Execution re-enters with a `REWORK REASON` line on the left panel.

### 5.5 Execution (BALTHASAR) — rework pass

```
TASK     : EXECUTION [REWORK 1/2]
SOURCE   : PLAN_V1 + RUBRIC_V1
HANDOFF  : 0 → 1
CONF     : MED → HIGH
SUMMARY  :
  - ADDED   : EMPTY_STATE, LOADING_STATE, ERROR_STATE
  - UPDATED : 2 TOKENS
  - TESTED  : 8 / 8 RUBRIC CHECKS PASS
VERDICT  : 承認
```

### 5.6 Evaluation (CASPER) — second pass

```
TASK     : EVALUATION [PASS 2]
SOURCE   : PROTOTYPE_V2
HANDOFF  : 0
CONF     : HIGH
RUBRIC   : ALL PASS
ISSUES   : 0
VERDICT  : 承認
```

Global: → `決議終了`.

### 5.7 `介入要請` branch (alternate script, selectable via debug flag)

Same as §5.4 but severity = `HIGH`, issue = `POLICY_VIOLATION`. Global
jumps straight to `介入要請`. This path is not on the default timer but is
triggered by a mock control so the state can be demoed without waiting two
minutes.

### 5.8 `異常停止` branch

Triggered by a simulated WebSocket drop that exceeds a reconnect budget.
Global → `異常停止`. The active hexagon freezes at its current progress and
shows a halt overlay. This is the only state where verdict stays `NONE`
despite progress being non-zero.

### 5.9 Voice-input mock transcripts

A small pool of scripted transcripts the overlay types out on each
invocation. Chosen in round-robin order so repeated presses feel varied
without the mock appearing to "remember" anything:

```
1. "tighten evaluation rubric around state coverage"
2. "add a loading skeleton to the hex cluster"
3. "reduce handoff count budget to two"
4. "switch backend to codex for the next pass"   # cosmetic only — does not
                                                 #   actually toggle TYPE;
                                                 #   TYPE is wheel-only
5. "mark this run as a design exploration not a ship candidate"
```

Each is typed at roughly 15–25 chars/sec with small jitter, then holds on
screen for ~600 ms before awaiting commit/cancel.

### 5.10 Mock runtime shape

The mock is a deterministic timeline of events keyed by `t_ms` since run
start. Consumers read `getMockState(now)` and get back a fully-formed
state object consistent with §3. This keeps the UI rendering pure and makes
it trivial to later replace with a real WS feed.

---

## 6. Visual behavior suggestions

Kept deliberately minimal — enhance what's there, don't invent new vocabulary.

### 6.1 Hexagon progress fill
- Fill is a **sweep** around the hexagon's perimeter (angular progress),
  not a vertical water-level fill. Matches the console aesthetic and avoids
  looking like a download bar.
- When the stage plateaus (see §5.3), fill visibly pauses; small inner
  tick or pulse continues so the stage doesn't look frozen.
- Inactive stages render dim; active stage renders at full brightness.
- Focused-but-not-active stage gets a thin outer ring, not a brightness
  bump — so "focus" and "active" stay visually distinct.

### 6.2 Verdict stamp
- Appears with a 1-frame overshoot and settle (feels like a physical stamp
  landing). Duration short — ~180 ms.
- `承認` is calm: green token, no pulse, fades to steady state.
- `否定` is loud: red token, one short shake, then settles. Not
  continuously flashing — that becomes noise on a screen you keep on.
- Stamp never animates *out* on its own; it persists until that stage
  re-enters via rework.

### 6.3 Rework feedback
- On transition into `再審中`: global badge does a single crossfade
  (not a flash), the re-entered hexagon's stamp lifts off with a soft fade,
  and the timeline segment hatch-fills left-to-right.
- The left panel appends (not replaces) a `REWORK REASON:` line above the
  usual summary lines for that stage — so the user can see *why* they are
  redoing it without chasing logs.

### 6.4 Bottom timeline
- Three segments, each independently animating. Active segment has a
  subtle moving fill (1–2 px scanning line) so the user can tell live from
  frozen at a glance.
- Caret between segments is a single triangular marker. On rework, the
  caret moves backwards visibly — do not snap. This is one of the rare
  cases where an animation carries load-bearing meaning.

### 6.5 Warning / intervention emphasis
- `介入要請` uses a low-frequency pulse (0.8 Hz) on the global badge only.
- The whole screen **does not** flash. Flashing the whole screen erodes
  the operator's trust in every other state light.
- System-health zone does *not* inherit the intervention pulse — two
  independent signals stay independent.

### 6.6 Model-type indicator
- User-toggled via scroll wheel. On toggle, the `CLD` ↔ `CDX` glyph
  crossfades (~120 ms) with a subtle 1-px inset flash on the zone's
  bounding frame so the change is felt without being loud.
- The glyph itself is the one from the Figma — do **not** substitute with
  plain text labels.
- Debounce: rapid wheel ticks collapse into a single toggle per ~200 ms
  window so jittery wheels don't strobe the indicator.

### 6.7 Voice-input overlay
- Entry: slide up from bottom over ~200 ms with a brief outline flash at
  the drawer's top edge.
- Waveform indicator: small, continuous, and tasteful — not an EQ display,
  not a pulsing dot. A 1-line waveform running under the transcribing text
  is enough.
- Typing cadence: 15–25 chars/sec with jitter (§5.9). Constant-rate typing
  reads as fake.
- Exit: commit crossfades the overlay out and briefly highlights the newly
  appended line in zone C. Cancel fades out with no downstream highlight.
- While the overlay is open, the console underneath continues animating
  normally — including verdict stamps and timeline movement. Pausing it
  would hide state changes behind a modal, which we explicitly do not want.

---

## 7. Risks & design cautions

Failure modes to watch for during implementation and review.

### 7.1 Decoration-over-signal
- **Risk:** hexagons, grids, and katakana accents make the screen *feel*
  informative while actually being noise.
- **Mitigation:** after implementation, cover each zone with your hand and
  ask "can I still tell the state of the run?" The answer for zones A, B,
  and D should be yes-for-their-part. If two zones are both needed to
  answer "is it running right now," one of them is redundant.

### 7.2 Semantic overlap between global and stage status
- **Risk:** user sees `審議中` top-right and `承認` on a hexagon and has
  to mentally reconcile them.
- **Mitigation:** enforce §3.4 invariants at the state-model layer, not in
  the renderer. Renderer should be pure from a single consistent state.

### 7.3 Left panel becomes a text dump
- **Risk:** we keep adding summary lines per stage until the panel is a
  wall of acronyms nobody reads.
- **Mitigation:** cap summary at 4 lines per stage. `HANDOFF`, `CONF`,
  `SOURCE` are always shown; the remaining 4 lines are the top dynamic
  signals. If a fifth signal matters, one of the existing four must go.

### 7.4 Fake progress
- **Risk:** progress bars that march at a constant rate, reaching 100% on
  a schedule, feel like theatre and destroy credibility.
- **Mitigation:** real runs have plateaus, backtracks, and jitter. The
  mock must model plateaus (§5.3) and non-monotonic `CONF` (§5.2). Even
  mocked, progress must be *uneven*.

### 7.5 `否定` presented as "failure"
- **Risk:** red everything, scary vibe, user thinks the system broke.
- **Mitigation:** `否定` is a **verdict**, not an error. `異常停止` is an
  error. They must look visually distinct. Keep `否定` in a judicial
  register (stamp, stillness) and `異常停止` in a technical register
  (halt overlay, dashed outline).

### 7.6 EVA fandom drift
- **Risk:** the project slides into reproducing MAGI screens from the show
  instead of building a console.
- **Mitigation:** if a visual element serves the reference but not the
  state model, cut it. The names MELCHIOR/BALTHASAR/CASPER stay because
  they map 1-to-1 to the three stages and earn their screen real estate.
  Japanese status tokens stay because they compress better than English
  equivalents on an 800-px wide display. Everything beyond that is
  negotiable.

### 7.7 State change invisible on a glance-only device
- **Risk:** CarThing is a glance device; users will look for ~1 second and
  leave. Sub-animations that only read in a 3-second stare are wasted.
- **Mitigation:** the three load-bearing transitions (stage completion,
  verdict stamping, entering intervention) must all be *frame-one readable*
  — state is already legible in the first rendered frame; the animation
  confirms, not conveys.

### 7.8 Mock divergence from future real data
- **Risk:** when the real harness arrives, its state shape differs from
  the mock and the renderer quietly breaks.
- **Mitigation:** define the state type first and have the mock produce it.
  The renderer never reads mock internals — only the state type. Future
  real feed replaces the mock behind the same interface.

### 7.9 Button-map regression
- **Risk:** repurposing `preset3` breaks muscle memory for the existing
  Home-double-bind.
- **Mitigation:** release note. Also, `preset2` still reaches Home — the
  capability isn't lost, only the redundancy is.

### 7.10 Back-button semantic drift
- **Risk:** in every other app, Back means "exit." In MAGI, Back means
  "open voice overlay." An operator building muscle memory elsewhere will
  reflexively press Back to leave MAGI and will instead trigger voice
  input — confusing and sticky.
- **Mitigation:** the hint line in the voice overlay must say how to
  cancel (`BACK: CANCEL`). Release note must call out the behaviour change.
  Consider adding a small "BACK ▸ VOICE" micro-hint somewhere static on
  the MAGI screen so the redefinition is discoverable without opening the
  overlay. Input routing tests must assert that Back while in MAGI does
  **not** call `switchApp` / `exit`.

### 7.11 Scroll-wheel semantic drift
- **Risk:** same class of risk as 7.10. Elsewhere the wheel adjusts
  volume or timer; here it toggles TYPE. An operator spinning the wheel
  expecting volume will silently flip backends.
- **Mitigation:** TYPE toggle is two-state with debounce (§6.6), so even
  a full spin at most flips once every ~200 ms — it can't runaway. Still,
  the wheel-only TYPE binding should be documented, and in a later
  iteration we may gate it (e.g., wheel must be held + turned). Not in v1.

### 7.12 Voice mock breaks the illusion
- **Risk:** a canned transcript that types out the same thing every time,
  or text that sounds generic, signals "this is fake" and poisons the
  rest of the console's credibility.
- **Mitigation:** keep the scripted pool small (~5 lines, §5.9), rotate
  through it, and keep each line *plausible as a real dictation to an AI
  design harness*. No "Hello World," no lorem ipsum. Also: never let the
  mock transcript reference features the rest of the console is not
  currently showing — the line "switch backend to codex" is cosmetic only
  (§5.9) precisely because it would otherwise write a cheque the rest of
  the screen can't cash.

---

## Resolved decisions (2026-04-15)

1. **Exit from MAGI.** No back-to-previous-app. Exit is via `preset1/2/4`
   only. Back is repurposed to the voice overlay (§4.7).
2. **First entry behaviour.** Entering MAGI when global is `IDLE` does
   **not** auto-start. The operator starts the run with a knob press.
3. **Model-type control.** Scroll wheel toggles `CLD` ↔ `CDX` locally.
   No debug flag needed; the input itself is the control. Backend routing
   is out of scope for v1 — toggling TYPE does not affect run state.
4. **Localization.** Japanese kanji status tokens are **literal glyphs**,
   not translatable strings. They stay the same in all UI languages.
5. **Touch input.** Ignored in v1. The renderer must not attach tap
   handlers to hexagons, timeline, or any other zone.

## Still open

*(none at design time — raise new ones here if they surface in implementation.)*

---

## What this doc is *not*

- Not a task breakdown. No file paths beyond the existing references, no
  TDD steps, no commit points.
- Not a visual spec. Colors, exact geometry, font sizes, and token names
  come from Figma and from the existing CSS; this doc only constrains
  *what the visual must communicate*, not how.
- Not a backend plan. The real harness is explicitly out of scope; when
  it exists, it slots in behind the mock interface defined in §5.9.

When this design is approved, the follow-up implementation plan will
cover: new `AppId` value, button remap, state types, deterministic mock
module (run timeline + voice transcript pool), renderer module for MAGI,
voice-overlay sub-view, MAGI-specific input routing (wheel/knob/back
reassignments with explicit touch no-op), tests for state invariants
(§3.4), mock timeline transitions, and input-routing regressions (Back
while in MAGI must not exit; wheel while in MAGI must not touch volume),
plus release-note updates for the `preset3` remap and the in-MAGI input
reassignments.
