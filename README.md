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

In the dashboard, open **SQL Editor → New query**. Paste the entire contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and
press **Run**.

That one script creates every table, the row-level-security policies, the
triggers that generate profiles and challenge days, the stats views and the
RPCs. You should see "Success. No rows returned".

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
    index.tsx                       your challenges, grouped by phase
    discover.tsx                    open challenges + invite code entry
    friends.tsx                     search, requests, friend list
    profile.tsx                     your profile and lifetime stats
  challenge/
    new.tsx                         create a challenge
    [id]/index.tsx                  standings, day grid, invites, requests
    [id]/day/[dayNumber].tsx        checkboxes + productivity timer
  join/[code].tsx                   invite link landing page
  user/[id].tsx                     someone else's profile

components/
  ui.tsx           design-system primitives (Card, Button, Field, Badge, …)
  ChallengeCard    list card with day progress and who is ahead
  DayGrid          the calendar, including the green-day states
  StatsPanel       head-to-head scoreboard and winner banner
  FocusTimer       circular stopwatch that races your opponent
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
- **The timer stores timestamps, not ticks.** Elapsed time is computed from
  wall-clock times, so backgrounding or force-quitting the app does not lose
  seconds. Nothing reaches the database until you tap *Log it*.
- **Row-level security is on for every table.** Non-participants cannot read
  another pair's ticks, logged time or standings — verified by the script in
  step 6.

---

## Design system

Everything visual comes from [`lib/theme.ts`](lib/theme.ts) — palette, gradients,
spacing, radii, elevation and a full type scale. Components read from it rather
than hard-coding values, so changing the accent colour or the type ramp in that
one file re-skins the app.

- **Type** — Space Grotesk for headings and every number (it has proper tabular
  figures, which the stopwatch needs), Inter for prose. Both load through
  `expo-font` behind the splash screen, so nothing renders unstyled.
- **Colour** — a near-black base with a cool cast, so the accent gradients read
  as light sources. Blue is *you*, violet is your opponent, green means done,
  amber means partly done. That mapping holds everywhere.
- **Motion** — React Native's `Animated` (no Reanimated, so no extra native
  dependency): buttons and cards scale on press, checkboxes spring, the timer
  ring sweeps, and the scoreboard bar slides when the standings change.

### Safe areas

From SDK 52 Android renders **edge-to-edge**: the app draws underneath the
status bar and the gesture/navigation bar rather than being letterboxed above
them. iOS has the same problem with the home indicator. So every screen has to
reserve those insets itself.

- **Tab screens** pass `edges={['top']}`. The tab bar reserves the bottom inset
  in [`app/(tabs)/_layout.tsx`](app/(tabs)/_layout.tsx) — note that setting an
  explicit `height` on `tabBarStyle` *overrides* react-navigation's automatic
  inset, so the height there is `BAR_CONTENT_HEIGHT + insets.bottom` with a
  matching `paddingBottom`. If you change that height, keep the inset in it.
- **Stack screens** (challenge, day, invite, profile) pass `edges={['bottom']}`
  — the navigation header already covers the top.
- **Auth screens** pass `edges={['top', 'bottom']}`; they have neither.

Layout is sized from `useWindowDimensions()` rather than fixed pixels where it
matters: the day grid divides each row evenly (5 cells per row, 6 above 430pt)
and the timer ring scales between 180 and 250pt. Verified with no horizontal
overflow at 320, 360 and 430pt.

### Font and icon imports

Both are imported per file rather than from the package root:

```ts
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import Ionicons from '@expo/vector-icons/Ionicons';
```

Metro cannot tree-shake `require()`d assets, so importing from the root ships
every weight and every icon family. Keeping the direct paths cut the bundle from
42 font files to 8. Follow the same pattern if you add a weight or a second icon
set.

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
