/**
 * Schema verification script.
 *
 * Signs up throwaway accounts and exercises every table, RPC, view and RLS
 * policy the app depends on. Run it after applying the migration to confirm
 * your database is wired up correctly.
 *
 *   node scripts/verify-schema.mjs
 *
 * Reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY from .env.
 *
 * NOTE: this creates real accounts and challenges. Point it at a local
 * `supabase start` stack, or be ready to delete the test rows afterwards.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON || URL_.includes('YOUR-PROJECT')) {
  console.error('Fill in .env first (see .env.example).');
  process.exit(1);
}

// Pull the real embed strings out of lib/api.ts so we test what the app ships.
const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
const grab = (name) => {
  const m = api.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\``));
  if (!m) throw new Error(`could not extract ${name} from lib/api.ts`);
  return m[1];
};
const grabStr = (name) => {
  const m = api.match(new RegExp(`const ${name} = '([^']*)'`));
  if (!m) throw new Error(`could not extract ${name}`);
  return m[1];
};
const PROFILE_COLS = grabStr('PROFILE_COLS');
const CHALLENGE_WITH_PEOPLE = grab('CHALLENGE_WITH_PEOPLE').replace(/\$\{PROFILE_COLS\}/g, PROFILE_COLS);
const FRIEND_COLS = grab('FRIEND_COLS').replace(/\$\{PROFILE_COLS\}/g, PROFILE_COLS);

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label} ${extra}`); }
};
const die = (label, error) => { fail++; console.log(`  FAIL  ${label} -> ${error?.message ?? error}`); };

const stamp = Date.now();
async function makeUser(handle) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `${handle}${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({
    email, password: 'password123',
    options: { data: { username: `${handle}${stamp}`.slice(0, 18), display_name: handle.toUpperCase() } },
  });
  if (error) throw error;
  if (!data.session) throw new Error('no session — local project requires email confirmation');
  return { client: c, id: data.user.id, email };
}

console.log('\n== auth: sign up two players ==');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
ok('two accounts created with sessions', Boolean(alice.id && bob.id));

const { data: aProf } = await alice.client.from('profiles').select(PROFILE_COLS).eq('id', alice.id).maybeSingle();
ok('profile auto-created by trigger', Boolean(aProf?.username), JSON.stringify(aProf));

console.log('\n== friends ==');
{
  const { error } = await alice.client.from('friendships')
    .insert({ requester_id: alice.id, addressee_id: bob.id, status: 'pending' });
  error ? die('send friend request', error) : ok('send friend request', true);

  const { data, error: e2 } = await bob.client.from('friendships').select(FRIEND_COLS)
    .or(`requester_id.eq.${bob.id},addressee_id.eq.${bob.id}`);
  if (e2) die('listFriendships embed (FRIEND_COLS)', e2);
  else ok('listFriendships embed resolves both profiles',
    data?.[0]?.requester?.username && data?.[0]?.addressee?.username, JSON.stringify(data?.[0]));

  // Search the exact handle: a shared prefix like "alice" can match users
  // left behind by an earlier run.
  const { data: sr, error: e3 } = await bob.client.rpc('search_users', { q: aProf.username });
  if (e3) die('search_users rpc', e3);
  else {
    const hit = sr?.find((u) => u.id === alice.id);
    ok('search_users finds alice with friend_status', hit?.friend_status === 'pending', JSON.stringify(hit));
  }

  const edgeId = data?.[0]?.id;
  const { error: e4 } = await bob.client.from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', edgeId);
  e4 ? die('accept friend request', e4) : ok('accept friend request', true);
}

console.log('\n== challenge creation ==');
const today = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const { data: challenge, error: cErr } = await alice.client.from('challenges').insert({
  creator_id: alice.id, title: 'Ship it sprint', description: 'Three days of deep work',
  day_count: 3, start_date: key(today), is_public: true,
}).select('*').single();
if (cErr) die('create challenge', cErr);
else {
  ok('challenge created', Boolean(challenge.id));
  ok('end_date computed by generated column', challenge.end_date === key(new Date(today.getTime() + 2*86400000)), challenge.end_date);
  ok('invite_code generated', /^[0-9a-f]{12}$/.test(challenge.invite_code), challenge.invite_code);
}

const { data: days, error: dErr } = await alice.client.from('challenge_days')
  .select('*').eq('challenge_id', challenge.id).order('day_number');
dErr ? die('days generated by trigger', dErr) : ok('3 days auto-generated by trigger', days.length === 3, `got ${days?.length}`);

console.log('\n== discover + invite ==');
{
  const { data, error } = await bob.client.from('challenges').select(CHALLENGE_WITH_PEOPLE)
    .eq('is_public', true).eq('status', 'open').is('opponent_id', null).neq('creator_id', bob.id);
  if (error) die('listOpenChallenges embed (CHALLENGE_WITH_PEOPLE)', error);
  else ok('open challenge visible to bob with creator embed', data?.[0]?.creator?.username != null, JSON.stringify(data?.[0]?.creator));

  const { data: prev, error: pe } = await bob.client.rpc('preview_invite', { p_code: challenge.invite_code });
  pe ? die('preview_invite rpc', pe) : ok('preview_invite returns the challenge', prev?.[0]?.title === 'Ship it sprint', JSON.stringify(prev?.[0]));
}

console.log('\n== join via invite code ==');
{
  const { data, error } = await bob.client.rpc('join_challenge_by_code', { p_code: challenge.invite_code });
  if (error) die('join_challenge_by_code', error);
  else ok('bob joined; status flipped to active', data?.status === 'active' && data?.opponent_id === bob.id, JSON.stringify(data?.status));

  const { error: dup } = await bob.client.rpc('join_challenge', { p_challenge_id: challenge.id });
  ok('re-joining a full challenge is rejected', Boolean(dup), dup?.message);
}

console.log('\n== tasks: creator-only editing ==');
const day1 = days[0];
const { data: t1, error: tErr } = await alice.client.from('tasks')
  .insert({ challenge_id: challenge.id, day_id: day1.id, title: 'Deep work 2h', position: 0 }).select('*').single();
tErr ? die('creator adds task', tErr) : ok('creator adds task', Boolean(t1.id));

const { data: t2 } = await alice.client.from('tasks')
  .insert({ challenge_id: challenge.id, day_id: day1.id, title: 'No phone before noon', position: 1 }).select('*').single();

const { error: bobTask } = await bob.client.from('tasks')
  .insert({ challenge_id: challenge.id, day_id: day1.id, title: 'sneaky', position: 2 });
ok('non-creator BLOCKED from adding tasks (RLS)', Boolean(bobTask), bobTask?.message);

console.log('\n== ticking checkboxes ==');
for (const t of [t1, t2]) {
  const { error } = await alice.client.from('task_completions')
    .upsert({ task_id: t.id, user_id: alice.id, challenge_id: challenge.id }, { onConflict: 'task_id,user_id' });
  if (error) die(`alice ticks ${t.title}`, error);
}
ok('alice ticked both tasks', true);

const { error: bobTick } = await bob.client.from('task_completions')
  .upsert({ task_id: t1.id, user_id: bob.id, challenge_id: challenge.id }, { onConflict: 'task_id,user_id' });
bobTick ? die('bob ticks his own copy', bobTick) : ok('bob ticks his own copy of task 1', true);

const { error: forge } = await bob.client.from('task_completions')
  .insert({ task_id: t2.id, user_id: alice.id, challenge_id: challenge.id });
ok('bob BLOCKED from ticking on alice behalf (RLS)', Boolean(forge), forge?.message);

console.log('\n== productivity timer ==');
{
  const { error: e1 } = await alice.client.from('focus_sessions')
    .insert({ challenge_id: challenge.id, day_id: day1.id, user_id: alice.id, seconds: 3600 });
  const { error: e2 } = await bob.client.from('focus_sessions')
    .insert({ challenge_id: challenge.id, day_id: day1.id, user_id: bob.id, seconds: 5400 });
  (e1 || e2) ? die('log focus sessions', e1 || e2) : ok('both players logged focus time', true);
}

console.log('\n== stats views ==');
{
  const { data, error } = await alice.client.from('challenge_day_progress')
    .select('*').eq('challenge_id', challenge.id).order('day_number');
  if (error) die('challenge_day_progress', error);
  else {
    const aliceDay1 = data.find(r => r.user_id === alice.id && r.day_number === 1);
    const bobDay1 = data.find(r => r.user_id === bob.id && r.day_number === 1);
    ok('alice day 1 is_complete = true (GREEN DAY)', aliceDay1?.is_complete === true, JSON.stringify(aliceDay1));
    ok('bob day 1 is_complete = false (1 of 2)', bobDay1?.is_complete === false, JSON.stringify(bobDay1));
    ok('per-day focus seconds recorded', aliceDay1?.focus_seconds === 3600 && bobDay1?.focus_seconds === 5400,
       `${aliceDay1?.focus_seconds}/${bobDay1?.focus_seconds}`);
  }

  const { data: lb, error: le } = await alice.client.from('challenge_leaderboard')
    .select('*').eq('challenge_id', challenge.id);
  if (le) die('challenge_leaderboard', le);
  else {
    const a = lb.find(r => r.user_id === alice.id);
    const b = lb.find(r => r.user_id === bob.id);
    ok('leaderboard has both players', lb.length === 2, `got ${lb.length}`);
    ok('bob leads the productivity race (5400 > 3600)', Number(b.total_seconds) > Number(a.total_seconds),
       `alice=${a?.total_seconds} bob=${b?.total_seconds}`);
    ok('roles labelled correctly', a?.role === 'creator' && b?.role === 'opponent', `${a?.role}/${b?.role}`);
  }
}

console.log('\n== my challenges list (embed) ==');
{
  const { data, error } = await alice.client.from('challenges').select(CHALLENGE_WITH_PEOPLE)
    .or(`creator_id.eq.${alice.id},opponent_id.eq.${alice.id}`).order('created_at', { ascending: false });
  if (error) die('listMyChallenges embed', error);
  else ok('listMyChallenges resolves creator AND opponent',
    data?.[0]?.creator?.username && data?.[0]?.opponent?.username, JSON.stringify({c: data?.[0]?.creator?.username, o: data?.[0]?.opponent?.username}));
}

console.log('\n== join requests flow (second challenge) ==');
{
  const { data: c2 } = await alice.client.from('challenges').insert({
    creator_id: alice.id, title: 'Open slot', day_count: 2, start_date: key(today), is_public: true,
  }).select('*').single();

  const { error: rErr } = await bob.client.rpc('request_to_join', { p_challenge_id: c2.id, p_message: 'let me in' });
  rErr ? die('request_to_join', rErr) : ok('bob requests to join', true);

  const { data: reqs, error: qErr } = await alice.client.from('challenge_join_requests')
    .select(`*, profile:profiles!challenge_join_requests_user_id_fkey(${PROFILE_COLS})`)
    .eq('challenge_id', c2.id).eq('status', 'pending');
  if (qErr) die('listJoinRequestsFor embed', qErr);
  else ok('creator sees request with profile embed', reqs?.[0]?.profile?.username != null, JSON.stringify(reqs?.[0]?.profile));

  const { error: respErr } = await alice.client.rpc('respond_to_join_request', { p_request_id: reqs[0].id, p_accept: true });
  respErr ? die('respond_to_join_request accept', respErr) : ok('creator accepts request', true);

  const { data: after } = await alice.client.from('challenges').select('*').eq('id', c2.id).single();
  ok('opponent slot filled + status active', after?.opponent_id === bob.id && after?.status === 'active', after?.status);
}

console.log('\n== privacy: a third party ==');
{
  const carol = await makeUser('carol');
  const { data: seen } = await carol.client.from('task_completions').select('*').eq('challenge_id', challenge.id);
  ok('outsider cannot read task_completions', (seen?.length ?? 0) === 0, `saw ${seen?.length}`);
  const { data: lb } = await carol.client.from('challenge_leaderboard').select('*').eq('challenge_id', challenge.id);
  ok('outsider cannot read leaderboard', (lb?.length ?? 0) === 0, `saw ${lb?.length}`);
  const { data: fs } = await carol.client.from('focus_sessions').select('*').eq('challenge_id', challenge.id);
  ok('outsider cannot read focus_sessions', (fs?.length ?? 0) === 0, `saw ${fs?.length}`);
}

console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}\n`);
process.exit(fail === 0 ? 0 : 1);
