# Buddy Mobile: what is built, what is tested, what is still to do

## Built and tested (52 automated tests pass)
| Area | What you can do |
|---|---|
| Reminders | "remind me at 18:00 to call mum", "remind me in 30 minutes to stretch", "remind me tomorrow 9am to …". Due reminders are announced once while the app is open (toast, tone, vibration, spoken if on). |
| Habits and streaks | "habit study 30 minutes", "did study 30 minutes", "habits". Streaks count consecutive days. |
| Routines | "save routine morning: good morning; drank 1 glass", then "run routine morning". Steps run in order and every change is kept. |
| What now | "what should I do now": the next reminder, else your top goal, else your first task. |
| Weekly review | "weekly review": tasks, goal steps, water, mood, best day, in plain words. |
| Insights and skills | An activity log feeds "insights" (last 7 days) and "skills" (five skill levels, shown in Settings). |
| Daily check-in | "check in: a short note about your day". |
| Calendar | "Download calendar (.ics)" in Settings saves open reminders as a calendar file. |
| Share | "share" or the Share button: uses the phone's share menu, or opens WhatsApp with the summary. |
| Two-phone sync | Cloud pull merges both phones: new tasks, notes, goals and habits from each side are kept; the same item is not duplicated. Water keeps the higher total. |
| Shortcuts | Home-screen shortcuts for Good morning, Add a task and Drink water (installed app). |
| Voice, themes, effects, goals, lists, health | As in v2 (see README). |

## Built but not tested on a real device
- Speech input and output (depends on the phone browser and its voices).
- Reminders while the app is open: they do not fire when the app is fully closed. That needs push notifications from a server, which is not built.
- Home-screen shortcuts (depends on the installed app and the phone).
- The calendar file opening in your phone's calendar app.

## Not built yet, and why
| Idea | Why not yet | What it needs |
|---|---|---|
| Real conversation with a language model (Gemini) | Needs a paid or limited key and a proxy on your Worker. Not tested live from here. | A Gemini key stored only in your Worker's secrets; a `/chat` route; a usage limit. |
| Natural cloud voice | Needs a text-to-speech service and a key. | The same kind of Worker route as above. |
| Wake word ("Hey Buddy") | Browsers cannot listen all the time reliably; needs a dedicated speech service. | A paid speech service with streaming, or a native app. |
| Background reminders when the app is closed | Needs push notifications from a server and the user's permission. | A Worker that sends web push, plus a service worker push handler. |
| Google Calendar read and write | Needs Google sign-in (OAuth) and an app verified by Google for sensitive scopes. | A Google Cloud project, consent screen, and a sign-in flow. |
| Google Tasks, Notion, email drafts | Each needs its own account and sign-in. | One connection at a time, each with its own setup. |
| Weather and news on Home | Needs a weather or news API key. | A key, and a Worker route so the key stays off the phone. |
| Spoken morning briefing | Needs a reliable scheduled trigger; browsers do not run schedules while closed. | Push notifications, as above. |
| Home-screen widgets | Browser apps cannot add widgets. Android widgets need a native app. | A native Android app (not part of this project). |
| Gemini-powered planning ("learn guitar in 3 months" becomes weekly steps) | Depends on the language model above. | As above. |

## Suggested next step
Build the Worker `/chat` route with a Gemini key stored only in your Worker, plus a monthly usage limit. That one change unlocks real conversation, a natural voice, and goal planning.
