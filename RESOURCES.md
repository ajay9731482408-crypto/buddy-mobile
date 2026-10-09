# Resources used for Buddy Mobile v2

These are the sources checked for the design, voice and motion choices. Browser support changes, so check each link before you rely on it.

## Voice (Web Speech API)
- **MDN, Web Speech API** (developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API): the reference for the two parts used here, `SpeechRecognition` (speech in) and `SpeechSynthesis` (speech out). Speech recognition needs the page to be served over a web server, not opened as a local file.
- **Mozilla Hacks, "Web Speech API"** (hacks.mozilla.org): the original explanation of `speechSynthesis`, `getVoices()` and `SpeechSynthesisUtterance`, with the note that `getVoices()` can be empty until the voices load.
- **Speech Synthesis API support notes** (testmuai.com learning hub): speech output works in Chrome, Edge, Firefox, Safari and Samsung Internet. Opera Mobile and the old Android browser have no speech output, so the app falls back to text there.
- **Speech recognition in the browser** (assemblyai.com tutorial): Chrome and Edge recognise speech through Google's servers, so the spoken words leave the phone for that step. Safari on iPhone and iPad needs iOS 14.5 or newer and uses the `webkitSpeechRecognition` name, which the app already handles.
- **Chrome and Chromium notes** (Xebia, 2024): recognition sends audio to a server, and the list of languages depends on the browser.

What this means in the app: voice input and output are optional switches. If a browser has neither, the app says so and works with typing. Voice quality depends on the voices installed on the phone. A higher-quality voice would need a paid cloud service with its own key, which is not part of this version.

## Design
- **Border radius rule** (the "Border Radius Tips" guide): an outer corner radius equals the inner radius plus the padding between them. Every card, row and button in the app uses `--r-outer = --r-inner + --pad`, so nested corners look even.
- **Motion scale**: one set of durations (0.15 s, 0.3 s, 0.5 s) and one easing curve for all movement. Calm mode and the phone's reduce-motion setting turn every animation off.

## Accessibility (recommended, not re-read in this session)
- **WCAG 2.2** (w3.org/WAI/WCAG22/quickref): colour contrast, focus visibility, target size (the app uses buttons of at least 44 px), and motion settings. The app uses visible focus rings, labels on every input, live regions for replies and messages, and a reduced-motion switch.

## Privacy and data
- Data stays on the phone (localStorage). Cloud storage is off until you set it up. The cloud copy uses your own Cloudflare account and your own sync secret.
- Device preferences (voice, theme, effects, sounds) are not synced, so each phone keeps its own look.

## Possible next steps (not built)
- A cloud voice (Gemini or another text-to-speech service) for a more natural voice, using a key stored only on your device or your own Worker.
- Reminders that fire at a set time (needs notification permission and is less reliable in browsers than in an installed app).


## Avatar (Buddy's face)
Buddy's avatar is an original drawing built for this app. Ideas that informed the behaviour, and how each was handled:

- **Louis-CFM/coucou** (github.com/Louis-CFM/coucou, a macOS notch companion called Mochi). Its code is MIT-licensed, but its README states that the name, the Mochi character, the icon and the sounds are © the author, all rights reserved. What was used: the *ideas* only. The eyes follow the pointer, a tap squishes the face, repeated taps make it dizzy, and it reacts to what is happening. Nothing from that project's code, art, sounds or name was copied, and Buddy's face is drawn from scratch.
- **Pointer events** (MDN, "Pointer events"): the pointer position is read from `pointermove`, and updates are batched with `requestAnimationFrame` so movement stays smooth.
- **Reduced motion** (MDN, `prefers-reduced-motion`): all avatar animation is switched off when the phone asks for reduced motion, and in Calm mode.
- **SVG** (MDN, "SVG"): the face is a single vector drawing, so it is sharp at any size and light to redraw.

Why this matters: if you ever publish Buddy, use your own name, character and artwork, and read the licence of any project you learn from.
