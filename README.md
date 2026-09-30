# Challenge App

A 1-v-1 accountability app. You and a friend pick a number of days, tick off the
same daily checklist, and race a productivity stopwatch. Complete every task for
a day and that day turns green on your grid. Whoever logs the most focused time
by the last day wins.

Built with **Expo (React Native) + TypeScript + Supabase**.

---

## What it does

- **Accounts** — email/password sign up and sign in, with a profile (display
  name, unique username, bio) created automatically on signup.
- **Friends** — search people by username, send/accept/decline friend requests.
- **Challenges** — pick a title, a length in days, a start date, and whether it
  is public. The end date is derived; one row per day is generated automatically.
- **Daily checkboxes** — the creator adds and deletes the tasks for each day.
  Both players tick their own copy, so progress is tracked per person.
- **Green days** — when *you* have ticked every task for a day, that day turns
  green on your grid. A dot shows whether your opponent finished it too.
- **Productivity timer** — a per-day stopwatch. Start, pause, and log the time;
  it keeps counting if you background the app or quit it entirely. You can also
  add time by hand if you forgot to start the clock.
- **Live standings** — who is ahead on total focused time, days completed, and
  tasks done, updating in real time as your opponent ticks things off.
- **Joining** — public challenges appear on Discover where people can request a
  slot, and the creator accepts or declines. Or share a private invite link
  (`challengeapp://join/<code>`) that drops someone straight in.

---

## Setup

You need [Node.js](https://nodejs.org) 20+ and the Expo Go app on your phone
(or an iOS/Android simulator).

### 1. Create a Supabase project

Go to [supabase.com/dashboard](https://supabase.com/dashboard), create a free
project, and wait for it to finish provisioning (about two minutes).

### 2. Create the database

In the dashboard, open **SQL Editor → New query**. Run the migrations in order,
one query at a time:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
   tables, RLS, triggers, stats views, RPCs.
2. [`supabase/migrations/0002_tasks_lock_notifications.sql`](supabase/migrations/0002_tasks_lock_notifications.sql)
   — challenge-wide task seeding, the end-of-challenge lock, and push.

`0002` is safe to run on a database that already has `0001`.

Between them these create every table, the row-level-security policies, the
triggers that generate profiles and challenge days, the stats views and the
RPCs. Each should report "Success. No rows returned".

### 3. Turn off email confirmation (recommended while testing)

By default Supabase emails every new signup a confirmation link, which is
awkward when you are creating two test accounts. Go to
**Authentication → Sign In / Providers → Email** and turn **Confirm email**
off. The app handles both cases, but with it off you are signed in immediately.

### 4. Add your keys

**Project Settings → API**, then copy:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon / public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Paste them into `.env` (copy `.env.example` if it is missing):

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

The anon key is meant to ship inside a client app — row-level security is what
protects your data, and it is enabled on every table.

### 5. Run it

```bash
npm install
npx expo start -c
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator, or `w` for
the browser. The `-c` clears the cache so the new `.env` is picked up.

### 6. Check your setup worked (optional)

```bash
node scripts/verify-schema.mjs
```

This signs up throwaway accounts and exercises every table, policy, view and
RPC the app relies on — 34 checks in total. It creates real rows, so prefer
running it against a local stack (see below) rather than your live project.

---

## Trying it with two accounts

The app is head-to-head, so you need two users:

1. Sign up as yourself, then sign up as a second account (a different email —
   use Expo Go on your phone plus `w` for the browser to run both at once).
2. From account A, create a challenge.
3. Either share the invite code with account B and paste it into
   **Discover → Have an invite code?**, or leave the challenge public and have
   account B request to join from Discover — then accept it as account A.
4. As the creator, open any day and add a few checkboxes.
5. Both accounts can now tick tasks and run the timer. Watch the standings move.

---

## How it fits together

```
app/
  _layout.tsx                       root stack, auth gate, setup notice
  (auth)/sign-in.tsx  sign-up.tsx
  (tabs)/
    index.tsx                       Today — tick today's tasks from anywhere
    challenges.tsx                  yours, grouped by phase + Browse toggle
    friends.tsx                     search, requests, friend list
    profile.tsx                     your profile and lifetime stats
  challenge/
    new.tsx                         create a challenge
    [id]/index.tsx                  standings, day grid, invites, requests
    [id]/day/[dayNumber].tsx        checkboxes + productivity timer
  join/[code].tsx                   invite link landing page
  user/[id].tsx                     someone else's profile

components/
  ui.tsx           design-system primitives (Button, Field, Badge, Rule, Stat, …)
  ChallengeCard    list card with day progress and who is ahead
  DayGrid          the calendar, including the green-day states
  StatsPanel       head-to-head scoreboard
  FocusTimer       the day's stopwatch
  TaskRow          animated checkbox row
  DateField(.web)  native date picker, with a browser fallback
lib/           supabase client, auth context, API layer, theme, types, helpers
supabase/migrations/0001_init.sql   the entire database
scripts/verify-schema.mjs           schema verification
```

### The data model

| Table | Purpose |
| --- | --- |
| `profiles` | One per auth user. Created by a trigger on signup. |
| `friendships` | One row per pair, in either direction, with a status. |
| `challenges` | Creator + opponent, length, dates, visibility, invite code. |
| `challenge_days` | One row per day, generated by a trigger on insert. |
| `tasks` | The checkboxes for a day. Only the creator can write. |
| `task_completions` | One row per (task, user). This is what "ticked" means. |
| `focus_sessions` | Logged productivity time, per user per day. |
| `challenge_join_requests` | Requests to take the open slot. |
| `push_tokens` | One row per signed-in device, so the opponent can be notified. |

Two views do the aggregation:

- **`challenge_day_progress`** — per user per day: tasks total, tasks done,
  `is_complete` (what colours a day green) and focus seconds.
- **`challenge_leaderboard`** — per user per challenge: total seconds, days
  complete, tasks done. Ordering by `total_seconds` gives the winner.

### A few decisions worth knowing

- **The creator owns the task list.** Both players tick the same checkboxes, so
  the competition is like-for-like. Only the creator can add or delete them.
- **Challenges are strictly two people.** `join_challenge` locks the row before
  filling the opponent slot, so two people racing for it cannot both win.
- **Future days are read-only.** You cannot tick tasks or log time for a day
  that has not started yet. The creator can still add tasks ahead of time.
- **A finished challenge is frozen.** Once the last day has passed, tasks,
  ticks and logged time can no longer change — enforced by database triggers,
  not just the UI, so it holds even against a direct API call. Past days stay
  fully editable *while* the challenge is still running.
- **The starting checklist is set at creation** and copied onto every day. The
  creator can still add or remove tasks on an individual day afterwards.
- **The timer stores timestamps, not ticks.** Elapsed time is computed from
  wall-clock times, so backgrounding or force-quitting the app does not lose
  seconds. Nothing reaches the database until you tap *Log it*.
- **Row-level security is on for every table.** Non-participants cannot read
  another pair's ticks, logged time or standings — verified by the script in
  step 6.

---

## Design system

Everything visual comes from [`lib/theme.ts`](lib/theme.ts) — palette, spacing,
radii and a full type scale. Components read from it rather than hard-coding
values, so the accent colour or the type ramp can be changed in that one file.

The direction is **athletic / editorial**: it should read like a results board,
not a SaaS dashboard. Four rules hold it together, and breaking any of them is
what made the earlier version look generic:

1. **No gradients.** Flat fills only.
2. **No glows.** Depth comes from contrast and hairline rules, not shadow.
3. **One accent.** Lime is *you*; orange is *your rival*. Nothing else in the
   app is coloured, so colour always carries meaning — a lime square is a day
   you completed, an orange bar is your opponent.
4. **Structure comes from rules and spacing,** not from wrapping everything in
   a card. Lists are full-bleed rows divided by hairlines.

- **Type** — Archivo (800/700/600) for headings and every number, set tight and
  uppercase; IBM Plex Sans for prose and labels. Numbers are always tabular so
  columns line up.
- **Surfaces** are neutral near-blacks with no blue cast, and radii are small —
  large pill shapes read as friendly consumer software, which this is not.
- **Motion** uses React Native's `Animated` (no Reanimated, so no extra native
  dependency): buttons and rows scale slightly on press, checkboxes spring, and
  the scoreboard bar slides when the standings change.

### Navigation

**Today** is the home tab. Ticking today's boxes is the thing you do every day,
so it sits one tap from launch rather than three screens deep — it shows today's
checklist across every live challenge, the head-to-head for the day, and a route
into the timer.

Discover used to be its own tab, which gave browsing strangers' challenges the
same weight as your own. It is a **Browse** toggle inside Challenges now, which
freed the tab slot Today uses.

### Font and icon imports

Both are imported per file rather than from the package root:

```ts
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import Ionicons from '@expo/vector-icons/Ionicons';
```

Metro cannot tree-shake `require()`d assets, so importing from the root ships
every weight and every icon family. Keeping the direct paths cut the bundle from
42 font files to 8. Follow the same pattern if you add a weight or a second icon
set.

---

## Notifications

There are two separate things here, and they have very different requirements.

### The productivity timer in the notification shade

While a timer is running the app posts an **ongoing notification** with
**Pause / Resume / Stop** buttons. Pressing one changes the same stored timer
the app reads, so the screen and the shade can never disagree.

Two deliberate choices:

- It shows **when the run started** ("Running since 14:32") rather than a count
  of elapsed seconds. Android only redraws a notification when the app replaces
  it, so an elapsed figure would quietly go stale while the shade sat untouched;
  a start time stays true no matter how long it sits there.
- The buttons **bring the app to the front**. The timer is timestamp-based, so
  a pause that arrived late would over-count. Opening the app guarantees the
  change is applied at the moment you pressed it.

A live per-second counter in the shade needs Android's notification
*chronometer*, which `expo-notifications` does not expose. Reaching it means a
third-party native module; the one that does this (`notifee`) has not been
published since December 2024 and predates the New Architecture this app runs
on, so it was not worth the risk.

**iOS shows no timer notification.** A live-updating one there requires Live
Activities (ActivityKit), which is a native widget extension in Swift. The app
is Android-only today, so this is not a practical limitation.

### Push when your opponent ticks a task

The server half is **done and verified**: ticking a task fires a Postgres
trigger that calls Expo's push service through `pg_net`, addressed to the
opponent's registered devices. It sends "… ticked a task", or "… finished day
N 🟩" when that tick completes their day. Tapping it opens that exact day.

Every send is wrapped so a notification problem can never roll back the tick
that caused it — verified with a missing extension, no registered device, and
a solo challenge.

**To actually receive them you need Firebase**, because all Android push is
delivered by FCM. There is no way around this; it is an OS-level requirement,
not a choice this app made. Until it is set up, `usePushRegistration` reports
`unavailable` and the app works normally without notifications.

1. Create a free Firebase project and add an Android app with the package name
   `com.challengeapp.mobile`.
2. Download `google-services.json` into the project root, then point at it:
   `"android": { "googleServicesFile": "./google-services.json" }` in app.json.
3. Create an Expo project id so a push token can be issued:
   `npx eas-cli init` (free account, no build required).
4. Give Expo permission to deliver through your Firebase project:
   `npx eas-cli credentials` → Android → push notifications → upload the FCM
   service account key.
5. Rebuild the APK. On first launch the app asks for notification permission
   and registers the device in `push_tokens`.

If you would rather not involve Expo at all, the alternative is a Supabase Edge
Function holding an FCM service account and calling FCM v1 directly — swap the
`send_expo_push()` body for a call to it. Expo's service is simply the shortest
path.

### Known gaps

- Expo replies `DeviceNotRegistered` for tokens belonging to uninstalled apps.
  The trigger does not read that reply, so a dead token lingers. Tokens are
  keyed per device and removed on sign-out, so this stays small.
- Only task completions notify. Friend requests, join requests and challenge
  invites do not yet.

---

## Building an installable Android APK

No Expo account needed — this builds entirely on your machine. You need a JDK
and the Android SDK (`brew install --cask android-commandlinetools`, then
`sdkmanager --licenses` and
`sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"`).

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
npx expo prebuild --platform android --clean
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

`prebuild` regenerates `android/`, which resets `gradle.properties`. Before
building, trim the architectures — the default packs four and triples the size:

```bash
sed -i '' 's/^reactNativeArchitectures=.*/reactNativeArchitectures=arm64-v8a/' android/gradle.properties
cd android && ./gradlew assembleRelease
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`.

**Size:** ~39 MB for arm64 only, ~91 MB if you leave all four architectures in.
`arm64-v8a` covers every Android phone from roughly 2015 onward.

**Signing:** the release build is signed with the bundled debug keystore, so it
installs and runs anywhere. That is fine for sharing directly, but the Play
Store will not accept it — generate a real keystore first if you ever publish.

**Shrinking further:** the dex files are ~39 MB uncompressed and dominate the
size. Setting `android.enableProguardInReleaseBuilds=true` in
`android/gradle.properties` typically halves that, but minification can break
reflection-based libraries, so test the resulting APK on a real device before
sending it to anyone.

---

## Running Supabase locally (optional)

If you have Docker, you can run the whole stack on your machine instead of
using the cloud project:

```bash
npx supabase start
```

It applies `supabase/migrations/0001_init.sql` automatically and prints a local
API URL and anon key to put in `.env`. Stop it with `npx supabase stop`.

---

## Notes

- Invite links use the `challengeapp://` scheme. In Expo Go during development
  the link is an `exp://` URL, which is expected; the invite **code** always
  works via Discover.
- Push notifications and avatar uploads are not implemented.
- `.env` is gitignored. `.env.example` is the template to copy.
