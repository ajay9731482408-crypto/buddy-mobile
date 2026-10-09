# START HERE: Buddy on your phone, step by step

This guide takes you from nothing to a working Buddy on your phone. It is written for people who have never used GitHub, Vercel or Cloudflare. Do one part at a time, and tick each box when it works.

**What you will end up with**
- Buddy on your phone's home screen, opening full screen like an app.
- Tasks, goals, reminders, habits, shopping, water and mood, all on your phone.
- Optionally, a copy of your data kept safely in your own Cloudflare account, so a second phone can get it.

**Time needed:** about 1 hour for Parts 1 to 4. Cloud sync (Part 6) takes another 30 to 45 minutes and is optional.

**Cost:** the steps use free accounts. Check each company's free-plan terms before you rely on them, because they can change.

---

## Part 0: Before you start (5 minutes)

Make sure you have:

- [ ] A **phone** with Chrome (Android) or Safari (iPhone).
- [ ] A **computer** with a web browser (Windows, Mac or Linux). You need it for the first upload.
- [ ] An **email address** to sign up with.
- [ ] The file **buddy-mobile.zip** (the file you downloaded).

Keep a notepad open. You will write down a few things. **Never post them online or send them to anyone.**

---

## Part 1: Unzip the project (5 minutes)

1. Find **buddy-mobile.zip** in your Downloads folder.
2. **Windows:** right-click it → **Extract All** → **Extract**.
   **Mac:** double-click it.
3. You should now have a folder called **buddy-mobile**. Open it. You should see files such as **index.html**, **app.js**, **README.md** and a folder called **icons**.

✅ **Checkpoint:** the **buddy-mobile** folder contains **index.html**.

---

## Part 2: Try Buddy on your computer (optional, 5 minutes)

This is a quick way to see Buddy before you put it online.

1. Open the **buddy-mobile** folder.
2. Click in the address bar at the top of the folder window, type `cmd` and press Enter. (Mac: open **Terminal** and type `cd ` then drag the folder into the window, then Enter.)
3. Type this and press Enter:
   ```
   python -m http.server 8080
   ```
   If you see "command not found", try `py -m http.server 8080` (Windows) or `python3 -m http.server 8080` (Mac). If you have no Python, skip this part; you can test it on Vercel in Part 3.
4. Open your browser and go to **http://localhost:8080**.
5. You should see Buddy's home screen with the text "Talk to Buddy". Type `help` and press Enter.
6. To stop the test, go back to the black window and press **Ctrl+C**.

✅ **Checkpoint:** Buddy answers `help` with a list of commands.

---

## Part 3: Put Buddy on the internet with Vercel (about 20 minutes)

Vercel will give Buddy a web address, such as **https://buddy-mobile-yourname.vercel.app**. Your phone will open that address.

### 3a. Create a GitHub account and a repository (a place for your files)
1. Go to **github.com**, click **Sign up**, and create a free account. Confirm your email.
2. Click the **+** at the top right → **New repository**.
3. **Repository name:** `buddy-mobile`
4. Choose **Public**. It is the simplest choice for this guide. Private repositories can also be used with Vercel, but the steps above assume Public.
5. Leave every other box empty. Click **Create repository**.

### 3b. Upload the files
1. On the new repository page, click **uploading an existing file** (or **Add file → Upload files**).
2. Open the **buddy-mobile** folder on your computer. Select **everything inside it** (press Ctrl+A on Windows or Cmd+A on Mac), then drag it into the GitHub page.
   - If the folder names do not appear, drag the files and the **icons** folder separately.
   - Do **not** upload the **buddy-mobile.zip** file itself.
3. Wait for the upload to finish. Scroll down and click **Commit changes**.

✅ **Checkpoint:** the repository page shows **index.html**, **app.js** and the **icons** folder.

### 3c. Connect Vercel and deploy
1. Go to **vercel.com** and click **Sign Up**. Choose **Continue with GitHub** and allow access.
2. Click **Add New… → Project**.
3. Find **buddy-mobile** in the list and click **Import**. If you cannot see it, click **Adjust GitHub App Permissions** and allow the repository.
4. On the setup page, check these settings:
   - **Framework Preset:** **Other**
   - **Build Command:** leave it **empty**. If it has a value, switch on the override and clear it.
   - **Output Directory:** leave it empty.
   - **Root Directory:** `./`
5. Click **Deploy**. Wait 1 to 2 minutes.
6. When you see confetti or the word **Congratulations**, click the picture of the site, or the address shown at the top (it looks like `https://buddy-mobile-yourname.vercel.app`).

✅ **Checkpoint:** the address opens Buddy in your computer's browser.

**Write down your Buddy address.** You will need it in Part 6.

**Future changes:** whenever you upload new files to GitHub, Vercel publishes them automatically within a minute or two.

---

## Part 4: Put Buddy on your phone's home screen (3 minutes)

Open the Buddy address on your phone first. The app must be opened from this address to install.

**Android (Chrome)**
1. Open the Buddy address in Chrome.
2. Tap the **⋮** menu (top right).
3. Tap **Add to Home screen** or **Install app**. Confirm.
4. Find the **Buddy** icon on your home screen and open it.

**iPhone (Safari)**
1. Open the Buddy address in **Safari** (not Chrome).
2. Tap the **Share** button (the square with an arrow).
3. Scroll and tap **Add to Home Screen**. Tap **Add**.
4. Open Buddy from the home screen.

✅ **Checkpoint:** Buddy opens from its own icon, full screen, with no browser bar.

---

## Part 5: Your first day with Buddy (10 minutes)

Buddy has five tabs at the bottom: **Home, Tasks, Goals, Lists, Health**. The gear icon at the top right opens **Settings**.

### 5a. Talk to Buddy (Home)
1. On **Home**, type **good morning** into the message box and tap the arrow button.
   - You should see a short summary of your day.
2. Tap a **chip** under the box (for example **tasks** or **water**) to run that command with one tap.
3. Tap the big **mic** button and say **add task call mum**. Buddy will hear it (if your browser allows the microphone; see Part 9).

### 5b. Tasks
1. Tap **Tasks**.
2. Type a task into **Add a task** and tap **Add**.
3. Tap the empty circle next to a task when it is done. It disappears from the list and your completion percentage goes up.

### 5c. Reminders
1. On **Tasks**, scroll to **Reminders**.
2. Type one of these and tap **Set**:
   - `remind me in 30 minutes to stretch`
   - `remind me at 18:00 to call mum`
   - `remind me tomorrow 9am to take tablets`
3. Keep the app open. When a reminder is due, Buddy shows it in the chat (and speaks it if you turned that on).

**Important:** reminders only ring while the app is open. Keep Buddy open, or in the background, for them to work.

### 5d. Goals
1. Tap **Goals**.
2. Under **New goal**, type what you want to reach (for example **learn guitar**), set **How many steps?** (for example **20**) and tap **Start goal**.
3. Each time you move forward, tap **+ step** on that goal. The bar fills up. When it is full, the goal is marked **Reached**.

### 5e. Lists and notes
1. Tap **Lists**.
2. **Shopping:** type `milk, eggs, bread` and tap **Add**. Tap the circle when you have bought an item.
3. **Notes:** type a note and tap **Save**.

### 5f. Health: water, mood and habits
1. Tap **Health**.
2. **Water:** tap **+ 1 glass** each time you drink a glass. The bar shows your total against 2000 ml.
3. **How do you feel?** tap a word (great, good, fine, meh, tired, awful). If you tap a low mood, Buddy gives a gentle reply and, if needed, points you to people who can help.
4. **Habits:** type a habit such as `study 30 minutes`, tap **Add**, then tap **Did it** each day. The number of days in a row grows.

✅ **Checkpoint:** you have at least one task, one goal and one glass of water recorded.

---

## Part 6: Settings: make Buddy yours (10 minutes)

Tap the **gear icon** at the top right.

### 6a. Voice
- **Hear Buddy reply:** on means Buddy speaks its answers. Switch off if you prefer silence.
- **Speak to Buddy:** on shows the mic button. Switch off to hide it.
- **Buddy's voice:** choose a voice from the list. "Automatic" picks the best one on your phone.
- **Speed:** slide to change how fast Buddy talks.
- Tap **Test Buddy's voice** to hear it.

### 6b. Look and feel
- Tap **Night**, **Teal**, **Warm** or **Light** to change the colours. The one with a coloured border is active.
- **Ambient effects:** soft floating light in the background. Switch off to save battery.
- **Calm mode:** turns off all movement. Good if motion bothers you.
- **Sounds and vibration:** a soft tone and a short buzz when you finish something.

### 6c. Plan and share
- **Download calendar (.ics):** saves your open reminders as a calendar file. Open it on your phone to add them to your calendar app.
- **Share my summary:** sends a short summary through your phone's share menu (or WhatsApp).
- **Weekly review:** a short summary of your week, in plain words.
- **Your skills:** shows how your skills grow as you use Buddy.

---

## Part 7: Turn on cloud sync (optional, 30 to 45 minutes)

Cloud sync keeps a copy of your data in **your own** Cloudflare account. Use it to share data between two phones, or to keep a backup. Your phone always keeps its own copy too.

You need a free **Cloudflare** account.

### 7a. Create a Cloudflare account
1. Go to **cloudflare.com** and click **Sign up**. Confirm your email.
2. Log in to the Cloudflare **dashboard**.

### 7b. Create a storage space (KV namespace)
1. In the dashboard, find **Storage & Databases** or **Workers & Pages**, then open **KV**. (Cloudflare moves these menus now and then. Look for the word **KV**.)
2. Click **Create a namespace**.
3. Name it **buddy-mobile** and click **Create**.

### 7c. Create the sync service (Worker)
1. Go to **Workers & Pages** → **Create** → **Create Worker** (or **Start with Hello World**).
2. Name it **buddy-sync**. Click **Deploy**.
3. Click **Edit code**. Delete all the text in the editor.
4. On your computer, open the **buddy-mobile** folder and open **worker.js** in Notepad (Windows) or TextEdit (Mac). Select everything, copy it, and paste it into the Cloudflare editor.
5. Click **Deploy**.
6. Note the address shown at the top of the Worker page. It looks like `https://buddy-sync.yourname.workers.dev`. **Write it in your notepad.**

### 7d. Connect the storage to the Worker
1. Open the **buddy-sync** Worker, then **Settings → Bindings**.
2. Click **Add** → choose **KV namespace**.
3. **Variable name:** `BUDDY_KV`
4. **KV namespace:** choose **buddy-mobile**.
5. Click **Save and deploy**.

### 7e. Create your two secrets
You will need two secret texts. Make each one with a **password manager's generator** (recommended), at least 24 characters, mixing letters and numbers.

1. **SYNC_SECRET:** the password that lets your phone use the sync service. Write it in your notepad.
2. **ALLOWED_ORIGIN:** your Buddy address from Part 3 (for example `https://buddy-mobile-yourname.vercel.app`). No slash at the end.

Now add them to the Worker:
1. Open **buddy-sync** → **Settings → Variables and Secrets** → **Add**.
2. Choose type **Secret**. Name: `SYNC_SECRET`. Value: paste your secret. Click **Add**.
3. Add a second one the same way. Name: `ALLOWED_ORIGIN`. Value: your Buddy address (type this as plain text, if your dashboard offers a Text type).
4. Click **Deploy** so the changes take effect.

### 7f. Connect the app to the sync service
1. On your phone, open Buddy and tap the **gear icon**.
2. Scroll to **Cloudflare cloud storage**.
3. **How to connect:** choose **My sync Worker (recommended)**.
4. **Worker address:** paste the address from step 7c (for example `https://buddy-sync.yourname.workers.dev`).
5. **Sync secret:** paste your **SYNC_SECRET**.
6. Leave **Remember it on this phone** off if the phone is shared. Switch it on for your own phone, so you do not need to type the secret again.
7. Tap **Save settings**, then **Test connection**.

✅ **Checkpoint:** the message under the buttons says **Connected. The cloud answered correctly.** and the status at the top says **Cloud ready**.

### 7g. Save and load
- **Save to cloud:** sends your data up. Nothing on the cloud copy is lost, because the app merges the two copies.
- **Load from cloud:** brings the cloud copy down and merges it with your phone.
- Once the cloud is ready, Buddy also saves a few seconds after each change.

### 7h. Add a second phone
1. Install Buddy on the second phone (Part 4).
2. Open Settings → **Cloudflare cloud storage**. Enter the same Worker address and the same **SYNC_SECRET**, then **Save settings**.
3. Tap **Load from cloud**. Your tasks, goals and reminders appear.

Items added on either phone are kept on both.

---

## Part 8: Backups, calendar and sharing (5 minutes)

- **Back up your data:** Settings → **Your data** → **Export a copy**. This saves a file to your phone's Downloads. Keep it somewhere safe, such as a cloud drive you trust.
- **Restore a backup:** Buddy cannot read a backup file back in yet. For now, keep the cloud copy, or use a second phone that has already synced (see Part 13 for what is not built yet).
- **Calendar:** Settings → **Download calendar (.ics)**. Open the file on your phone.
- **Share:** Settings → **Share my summary**.

---

## Part 9: Everyday routine (2 minutes a day)

1. Open Buddy and tap **good morning** in the chat.
2. Check **Tasks** and **Goals**. Finish a task or step.
3. Drink water and tap **+ 1 glass**.
4. Tap how you feel in **Health**.
5. Once a week, tap **Weekly review** in Settings.

---

## Part 10: When something goes wrong

| What you see | What to do |
|---|---|
| The Vercel page says **404: Not Found** | In Vercel, open the project → **Settings → General**. Check **Root Directory** is `./` (or the folder that holds **index.html**). Redeploy. |
| Buddy looks old after an update | Reload once while you are online. |
| The mic does nothing | Allow the microphone for this site in your browser settings. Use Chrome, Edge or Safari. Make sure the address starts with **https**. |
| No spoken replies | Check **Hear Buddy reply** is on. Try another voice under **Buddy's voice**. |
| A reminder did not ring | Keep Buddy open or in the background. Reminders do not ring when the app is fully closed. |
| "Could not reach your Buddy Worker" | Check the Worker address starts with **https://** and the Worker is deployed. Check your internet connection. |
| "The Worker refused this app address" | Your Buddy address does not match **ALLOWED_ORIGIN** exactly. Fix it in Cloudflare and click **Deploy**. |
| "The sync secret is wrong" | The text in the app must match **SYNC_SECRET** exactly. Copy it again. |
| "The storage binding BUDDY_KV is missing" | Go back to step 7d and deploy again. |
| "Could not reach Cloudflare" | Some browsers block the direct method. Choose **My sync Worker (recommended)** instead. |
| Items disappeared on one phone | Tap **Load from cloud**. Items are merged, so nothing is lost on the cloud copy. |
| Cloud sync stopped after you cleared data | Clearing pauses sync on that phone. Tap **Save to cloud** or **Load from cloud** to turn it on again. |
| "This phone is out of storage space" | Export a copy (Settings → Your data), then clear some old data. |

---

## Part 11: Privacy and safety

- Your data lives on your phone. Nothing leaves your phone unless you turn on cloud sync.
- The cloud copy is in **your** Cloudflare account, locked by your **SYNC_SECRET**.
- Keep your **SYNC_SECRET** and any API tokens private. Do not paste them in chat, emails or screenshots.
- On a shared phone, leave **Remember it on this phone** off, and tap **Forget token** when you finish.
- Buddy is a companion, not a doctor or counsellor. If you feel unsafe, contact someone you trust or your local emergency number.

---

## Part 12: Words used in this guide

- **Repository (GitHub):** a folder of files stored online.
- **Vercel:** a free service that puts your files on the internet with an address.
- **Cloudflare:** a service that runs your sync Worker and stores your cloud copy.
- **Worker:** a small program that runs on Cloudflare and answers your phone's sync requests.
- **KV namespace:** a storage space inside Cloudflare.
- **Secret / token:** a password that a program uses. Keep it private.
- **Home screen install:** adding Buddy to your phone so it opens like an app.

---

## Part 13: Not built yet

Buddy cannot yet: ring reminders when the app is closed; hold real conversations with a language model; use Google Calendar, Notion or email; show weather or news; or restore a backup file. See **ROADMAP.md** for what each one needs.

---

**Need more detail?** See **README.md** (the technical reference) and **RESOURCES.md** (sources and design notes).
