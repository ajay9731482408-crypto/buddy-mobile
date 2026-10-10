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


## Natural voice and the smart agent (added with v6)
- **Google Gemini text-to-speech** (ai.google.dev, "Speech generation"): the voice is requested with `responseModalities: ["AUDIO"]` and a named voice. The service returns raw 16-bit audio, which the Worker wraps in a WAV header so every browser can play it. Chosen because, in the 2026 listening board we checked, Gemini's speech models ranked near the top. Results depend on the voice you pick and on the phone.
- **Anthropic Messages API** (docs.anthropic.com, "Messages"): the agent calls the model with a system instruction and the recent conversation. The instruction asks for JSON with a short answer and a list of commands. The app accepts only commands from Buddy's own list.
- **Why keys stay on the Worker:** browsers can be inspected, so any key in the app can be taken. The Worker holds the keys, checks the sync secret, and limits daily use.
- **Honest limit:** this is not "all the resources on the internet" in one app. It is a small set of tested, documented services. Each new one needs its own key, terms and testing.

## Bible Strong Avatar Lab (saksham.700x post, 2026): decision
- The post describes an open-source avatar studio (avatars.bible-strong.app) that exports code under **AGPL-3.0**. I could not open the site or its repository from the build environment, so I did not copy any of its code.
- Why not copied: AGPL-3.0 applies to software run over a network. Buddy is published on Vercel, so using AGPL code would oblige you to publish all of Buddy under AGPL and make its source available to users.
- What was done instead: the **ideas** from the post are built in Buddy's own avatar code. The face reacts to a mistake (worried, and the field shakes), celebrates a success (happy), and wakes up when the page opens.
- If you want that studio's artwork: export your own design from the studio, check its terms for commercial use, and tell me the file names. Static art can then be used without importing its code.


## The notch (Buddy Mobile)
- The notch is an original component, written for Buddy (the same design as the notch in the Buddy launch project). It has five states: idle, working (a label and a moving bar), result (a green or red dot after each reply), alert (reminders with buttons), and open (quick actions). Its state logic is pure and tested (12 tests).
- Ideas: the "dynamic island" style pill used by phones. No code was taken from any other project.


## Voice: Amazon Polly (v7)
- **Amazon's own Alexa voice is not available to third-party apps.** Buddy uses **Amazon Polly** neural voices instead (aws.amazon.com/polly). These come from the same family of speech technology, and they sound natural. They are not the Alexa voice itself.
- Polly is called from the Worker with **AWS Signature Version 4**, written with the Web Crypto API. It is checked against AWS's published test vector ("get-vanilla"), so the signing matches AWS's specification. The AWS secret key stays on the Worker and is never sent to the phone.
- Polly's audio is raw 16-bit PCM at 16 kHz. The Worker wraps it in a WAV header so any browser can play it.
- Honest limit: this was not run against the live AWS service from the build environment (no internet access). The first real call on your Worker is the test that matters.


## Free open-source voice (v8): what was compared and chosen
Sources: a 2026 open-source TTS guide (tts.ai), a mid-2026 comparison (dev.ocdevel.com), and the project pages on GitHub and Hugging Face.

| Option | Licence | Runs on a phone? | Keys or card | Decision |
|---|---|---|---|---|
| **Kokoro** (hexgrad/kokoro, 82M parameters) with **kokoro-js** and Transformers.js | Apache 2.0 | **Yes**, in the browser (WebAssembly, or WebGPU where available) | None | **Chosen as the default free voice.** |
| Piper | MIT | Designed for very small devices (CPU, Raspberry Pi) | None | Kept as an option for a future offline build. |
| Chatterbox (Resemble AI) | MIT | No, needs a GPU and Python | None | Not used in the app. Strong for voice cloning on a computer. |
| Fish Audio S2 | Research licence (commercial use is paid) | No | Paid for commercial use | Not used. |
| Orpheus | Llama 3.2 licence | No (large) | None | Not used. |

**Honest notes**
- The browser library and the model are loaded from public CDN and model hosting. Before publishing the app, pin an exact version of `kokoro-js` (the code uses `@1` for now) and check the library's current README for the loading options.
- The model was not downloaded or listened to in the build environment (no internet access). The first real reply on a phone is the test that matters.
- If you publish Buddy, keep the Apache 2.0 notice for Kokoro with the app.


## Better agent: tool use (v9)
Sources: Anthropic's documentation for the Messages API (tool use, `input_schema`, `tool_use` and `tool_result` blocks, parallel tool calls), and a 2026 guide to Claude function calling (dev.to). Their advice, applied here:
- **Define each action as a named tool** with a JSON schema for its inputs, instead of asking the model to write JSON as text. Done: nine tools, each with a strict schema, defined on the Worker.
- **One tool, one job.** No "do anything" tool. There is no delete tool at all.
- **Pair every tool request with a result** using its id. Done: the phone sends each `tool_result` back with the matching `tool_use` id, and the model's own request stays in the conversation.
- **Check inputs before they run.** Done: the phone re-checks every input (types, ranges, lists, allowed words) and runs only the matching Buddy command. Invalid requests are not run, and the model is told why.
- **Limit the loop.** Done: at most four model turns per message.
- **Strict schemas.** Each tool sets `strict: true`, which Anthropic describes as making tool inputs follow the schema exactly. Check the current docs if the API ever rejects the field.
