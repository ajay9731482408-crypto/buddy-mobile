# Buddy: design decisions, interface comparison and agent design

## 1. What the research said (sources in RESOURCES.md)
- **Hybrid beats pure chat.** Several 2026 design guides agree: chat is good for open questions and discovery, and poor for exact actions. Structured controls (buttons, cards, chips) handle exact actions.
- **Recovery is part of the design.** A mistake should keep the user's work, say what went wrong in plain words, and offer a next step. Error states decide whether a product feels trustworthy.
- **Show what the system knows.** Clear status ("thinking", "done", "needs a look") and honesty about what Buddy cannot do build trust.
- **Agents need one tool per job, checked inputs, a step limit, human approval for risky actions, and a golden test set run on every change.**

## 2. Interface options compared
| Option | Good at | Weak at | Verdict for Buddy |
|---|---|---|---|
| Chat only | Open questions, a friendly feel | Exact actions are slow to type; errors hide in the thread | Not enough alone |
| Tabs and forms only | Exact actions, quick scanning | Feels cold; no way to ask a question | Not enough alone |
| **Hybrid: Home chat + task cards + notch status** | Both, plus visible status | More surfaces to keep consistent | **Chosen** |
| Voice-first | Hands-free use | Hard to correct; privacy in public | Offered as an option, not the main path |

## 3. The chosen design (implemented in this version)
- **Home:** a short summary, the avatar (states: idle, listening, thinking, happy, worried, alert), chat, and suggestion chips.
- **Notch:** always-visible status: thinking, the result of each reply, and due reminders with **Done** and **Snooze**. This is the trust layer: the user always sees what Buddy is doing.
- **Cards and tabs:** Tasks, Goals, Lists, Health, each with direct controls. Exact actions do not need chat.
- **Errors:** a mistake makes the field shake and Buddy look worried. The chat says why, and the built-in commands still work when the agent is off or unreachable.
- **Settings:** every outside service is off by default and says what leaves the phone.

**Redesigned in v10 (this version):** every screen is now built from one design system: a surface card, a stat tile, a list item, buttons, chips, fields and switches, all on a 4-pixel spacing scale. Corners follow the nested-radius rule (outer = inner + padding). The Home screen has a **Today** card that shows the next reminder, the focus goal and open tasks: this is the context panel. Each screen has one primary action.

**Still to do:** a side drawer on tablets (the phone layout is one column), and a full accessibility audit against WCAG 2.2.

## 3a. Design system (v10)\nTokens: colours per theme; spacing s1-s5 (4, 8, 12, 16, 24 px); radius inner 14 px, outer = inner + padding; motion: 0.15 s, 0.3 s, 0.5 s with one easing curve. Components: surface, stat, list-item, btn (primary, quiet, danger), chip, field, switch, segmented, bar, composer, notch, avatar, nav. Calm mode and reduced-motion switch all motion off.\n\n## 4. Agent design, from the ground up
| Layer | What Buddy has | Where it lives |
|---|---|---|
| Model | Claude through the user's Worker; keys never on the phone | worker.js |
| Instructions | Persona, short answers, tool rules, common-sense rules | agent.js `buildSystem` |
| Tools | Nine narrow tools, strict schemas, no delete | worker.js `AGENT_TOOLS` |
| Input checks | Every tool input re-checked on the phone | agent.js `validate` |
| Loop | Max four model turns per message; paired tool results | agent.js `runAgent` |
| Memory | Last twelve text turns in the session; the real data lives on the phone | app.js `history`, `summaryText` |
| Guardrails | Daily limit; no delete; no outside tools; safety replies for distress | worker.js, agent.js |
| Human in the loop | Asks before more than five changes; asks for missing times | instructions |
| Evaluation | 20 golden conversations and tool checks, run on every `npm test` | evals/golden.test.mjs |
| Observability | Not yet: no logs of tool use are kept | open item |

**Common-sense rules now enforced in code, not only in instructions:**
- No duplicate tasks; the existing number is returned.
- Reminders must be in the future and within a year.
- A water entry must be 1 to 20 glasses; a very full day (3 litres or more) gets a check-in question.
- A goal needs at least one step.
- "did ..." counts as a habit only when that habit exists.

## 5. Known limits (honest)
- Buddy's intelligence is a combination of fixed rules (for commands), a language model (for free talk, through the user's Worker), and checks. It is not a general-purpose intelligence, and it can be wrong.
- Reminders only ring while the app is open.
- The model was not run live from the build environment; the golden set tests the rules and tools, not the model's wording.
- Mood and health replies are general support, not medical advice.

## 6. How to measure progress
Run `npm test`. The golden set must stay green. When a new behaviour is added, add a golden case for it first.
