# APP_SPEC.md — Device Check

## 1. Product identity

- **Name:** Device Check
- **One-sentence purpose:** Check common device inputs, outputs, and browser hardware APIs from one privacy-friendly page.
- **Primary users:** People troubleshooting a PC, smartphone, tablet, browser, meeting setup, controller, or newly purchased device.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Problem and outcome

Device troubleshooting is usually split across separate camera, microphone, speaker, keyboard, screen, touch, gamepad, and sensor websites. Device Check brings the common checks into one page while keeping captured media and input values inside the browser.

In one session, a user can:

- confirm that a camera produces video and inspect the reported resolution / FPS;
- run a guided pre-call sequence for camera, microphone, and speakers;
- confirm microphone activity and inspect waveform, peak, noise floor, stereo balance, and audio settings;
- play left / center / right speaker test tones and record a manual result;
- inspect a display with solid colors, gray steps, checker/fine-line/RGB patterns, image-retention check, and 60/120Hz motion comparison;
- inspect keyboard `key`, `code`, modifiers, simultaneous presses, and Ghosting / N-key rollover behavior;
- inspect mouse / pen / touch coordinates, pressure, and observed simultaneous touch count;
- inspect gamepad buttons, axes, and haptics where supported;
- inspect orientation and acceleration sensors where available;
- view support for related browser APIs.

A local single-HTML implementation is useful because no captured media needs to be uploaded and the tool can be kept as a portable troubleshooting file.

## 3. Core user flow

1. Open the page locally or through GitHub Pages.
2. Review browser, platform, screen, and touch summary information.
3. For a meeting setup, start the guided pre-call quick check, hide/restore that guide as needed, or choose a test. Desktop uses the eight shortcut cards; smartphones use the fixed four-tab bottom navigation.
4. For permission-gated tests, explicitly press Start and respond to the browser permission prompt.
5. Interact with the device and inspect live values.
6. Repeat for other tests; the summary shows how many tests have been checked.
7. Stop camera / microphone / sensors when finished or close the page; active tracks are stopped on page exit.

## 4. Functional requirements

### Camera
- Start only after user action.
- Request only video permission.
- Preview locally with `playsinline`.
- Show reported resolution, frame rate, and facing mode where exposed.
- Populate available cameras after permission reveals device labels.
- Allow switching devices and stopping the stream.

### Microphone
- Start only after user action.
- Request only audio permission.
- Do not record audio.
- Show a live RMS-based input level meter and waveform.
- Estimate current dB, peak level, and a rolling noise floor.
- Show left/right channel levels when stereo input is exposed.
- Show sample rate, channel count, and echo-cancellation setting where exposed.
- Populate available microphones after permission reveals device labels.
- Allow switching devices and stopping the stream / audio context.

### Capture lifecycle and recovery
- Camera and microphone requests have independent generations and operation-owned resources.
- Stop, replacement, device selection changes, and page exit invalidate pending acquisition, default-device fallback, playback, audio setup, and device-list results.
- Stop is enabled immediately while starting; Start is disabled during the pending attempt. An obsolete stream that arrives later is stopped without attaching it.
- Stop releases tracks, the camera preview source, microphone graph nodes, AudioContext, and animation frames. Current input termination also releases resources and offers retry; stale termination cannot interrupt a newer session.
- Check Web Audio availability before requesting microphone access. Rejected playback or audio startup must not count as a successful check.
- Device-list failure is recoverable when capture is working: preserve capture and Stop, with a localized warning and retry hint.
- Localized pending, stopped, input-ended, and failure hints survive language changes. Checked records a completed session result and is separate from current capture activity.
- Stop cancels application ownership of the request, but cannot guarantee dismissal of the browser's permission prompt.

### Speaker
- Generate a short local Web Audio sine tone.
- Allow center, left, and right pan tests where stereo panning is available.
- Expose a conservative volume slider.
- Require the user to mark whether sound was heard; do not pretend to detect acoustic output automatically.

### Display
- Provide black, white, red, green, blue, continuous gradient, 16-step gray, checkerboard, 1px fine-line, and RGB gradient patterns.
- Provide an image-retention flow that switches from a high-contrast pattern to neutral gray.
- Provide a motion comparison with a 60fps reference and a display-refresh animation, including a requestAnimationFrame-based refresh estimate.
- Open the selected pattern in a full-viewport overlay and request Fullscreen when available.
- Exit with the on-screen close control or Escape.

### Keyboard
- Capture key events only while the dedicated test area is focused.
- Display `key`, `code`, Shift/Ctrl/Alt/Meta state, unique key count, and a short recent-key history.
- Maintain a visual keyboard map and highlight currently held keys.
- Show current and maximum simultaneous held-key counts for Ghosting / N-key rollover checks.
- Prevent test keystrokes from triggering unrelated page actions while the test area is focused.

### Pointer / touch
- Use Pointer Events.
- Display pointer type, x/y position, pressure, `navigator.maxTouchPoints`, current active touches, and the maximum simultaneous touch count observed during the session.
- Support simultaneous touch pointers visually with separate markers.
- Use `touch-action: none` only inside the dedicated test surface.

### Gamepad
- Use the Gamepad API without external libraries.
- Explain that some browsers expose controllers only after a button interaction.
- Display controller identifier, all buttons, pressed state, and axes.
- Detect `vibrationActuator` / `hapticActuators` where exposed and provide weak and strong rumble tests.

### Motion sensors
- Support Device Orientation and Device Motion where available.
- Request iOS-style permission only from a Start button when `requestPermission()` exists.
- Show alpha/beta/gamma and acceleration including gravity when exposed.
- Allow stopping listeners.

### Capability summary
- Show support for getUserMedia, Web Audio, Pointer Events, Gamepad, Device Motion, WebGL, WebGPU, MediaRecorder, WebCodecs, Clipboard, Fullscreen, and Vibration.

### Quick diagnosis
- Offer an optional guided pre-call flow for camera → microphone → speakers.
- Never request camera or microphone permission automatically when the flow starts; the user must explicitly press each device Start button.
- Keep the guide visible while active and allow direct step navigation.

### Shared UX
- Japanese / English UI in the same HTML.
- Light mode only.
- No runtime network requests.
- Help dialog explains permissions, secure-context limitations, speaker-test limitation, and privacy.
- Test status states: untested, checking, checked, needs attention, unsupported.
- No test result persistence; only language preference may use localStorage.

## 5. Data and privacy

- Camera frames stay in the local `<video>` preview.
- Microphone samples are used only for a live level calculation and are not recorded.
- Keyboard, pointer, gamepad, and sensor values stay in page memory.
- No user test data is sent over the network.
- CSP keeps `connect-src 'none'`.
- No analytics, telemetry, login, cloud storage, or remote font.

## 6. Non-goals

- Hardware certification or benchmark scoring.
- Automated speaker acoustic verification.
- Network speed, latency, or WebRTC connectivity testing, because the default app intentionally performs no network requests.
- Persistent diagnostic history.
- OS-level driver inspection unavailable to the browser sandbox.
- Exact physical display calibration.

## 7. UX and accessibility

- Mobile-first responsive layout from 320px upward.
- At 600px and below, use a fixed four-tab bottom navigation and show only the selected page group: Overview, Camera & Audio, Input, or Display & Device. Desktop keeps the continuous single-page layout.
- Test cards are real buttons and detailed sections have headings.
- Keyboard test captures input only when its focusable test area is active.
- Visible focus indicators are required.
- Status changes have both text and color; color is never the only signal.
- Permission errors are described without claiming hardware failure.
- Fullscreen display overlay provides an explicit close control and exits with Escape.
- Motion respects `prefers-reduced-motion`.
- Camera preview uses `playsinline` for smartphones.

## 8. Performance expectations

- Initial UI is interactive without network access.
- No heavy dependencies or model loading.
- Camera and microphone processing should remain smooth on typical current mobile devices.
- Gamepad, microphone, and display-motion animation loops stop or are released when their resources are no longer needed or the page exits.

## 9. Browser target

Current stable Chromium, Firefox, and Safari on desktop and mobile where the corresponding Web APIs are supported.

Direct `file://` opening is required for the application shell and non-permission tests. Some browsers restrict camera, microphone, fullscreen, or motion APIs to secure contexts; the UI and help must state this and users can use the GitHub Pages HTTPS build when needed.

## 10. Acceptance criteria

- The repository remains template-compatible and dependency-free by default.
- `src/index.template.html` contains exactly one each of the three build placeholders.
- `build-standalone.ps1` can generate readable and self-extracting HTML on the template's supported Windows environment.
- Generated HTML contains no external runtime script, stylesheet, font, iframe, or network API call.
- CSP includes `connect-src 'none'`.
- All eight test sections are reachable and usable at 360px width.
- Camera and microphone are never requested on initial page load.
- Camera and microphone Stop actions release their MediaStream tracks.
- Page exit releases camera / microphone and sensor listeners, including streams delivered after exit.
- Automated synthetic lifecycle regressions cover overlaps, interruption at every asynchronous stage, stale callbacks, default fallback, cleanup, and camera/microphone independence. These do not certify physical devices or OS indicators.
- The checked-in `device-check.html` download matches the readable build except its build timestamp; the self-extract payload restores exact readable bytes.
- Speaker tone is generated locally with Web Audio.
- Display patterns are generated locally with CSS/DOM animation; no remote assets are required.
- Keyboard events are not globally intercepted outside the keyboard test area.
- Gamepad haptics and motion tests fail gracefully when unsupported.
- `assets/favicon.svg` matches the embedded favicon / header visual concept.
- Japanese and English copy fits the mobile layout without horizontal overflow.
- On smartphones, the fixed bottom navigation remains reachable with safe-area padding, only the selected test group is visible, tap targets remain comfortable, and the guided quick check can be dismissed without losing access to it.

## 11. Explicit decisions

- **Input files:** none.
- **File exports:** none.
- **Third-party dependencies:** none.
- **Persistence:** language preference only.
- **Undo/redo:** not needed; tests are transient.
- **Heavy async phases:** not applicable; permission-gated tests use untested → checking → checked / needs-attention / unsupported.
- **Bilingual UI:** required.
- **Network test:** intentionally excluded because it conflicts with the no-runtime-network privacy boundary.
