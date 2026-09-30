import { supabase } from './supabase';
import { todayKey } from './format';
import type {
  Challenge,
  ChallengeDay,
  ChallengeWithPeople,
  DayProgress,
  FocusSession,
  FriendEdge,
  JoinRequestWithChallenge,
  JoinRequestWithUser,
  LeaderboardRow,
  Profile,
  Task,
  TaskCompletion,
  UserSearchResult,
} from './types';

const PROFILE_COLS = 'id, username, display_name, avatar_url, bio, created_at';

// Two FKs point at profiles, so embeds must name the constraint explicitly.
const CHALLENGE_WITH_PEOPLE = `
  *,
  creator:profiles!challenges_creator_id_fkey(${PROFILE_COLS}),
  opponent:profiles!challenges_opponent_id_fkey(${PROFILE_COLS})
`;

function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

/* ------------------------------------------------------------------ */
/*  Profiles                                                           */
/* ------------------------------------------------------------------ */

export async function getProfile(id: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle();
  return unwrap(res) as Profile | null;
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'display_name' | 'bio' | 'username' | 'avatar_url'>>
): Promise<Profile> {
  const res = await supabase.from('profiles').update(patch).eq('id', id).select(PROFILE_COLS).single();
  return unwrap(res) as Profile;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const res = await supabase.rpc('search_users', { q: query });
  return (unwrap(res) as UserSearchResult[]) ?? [];
}

/* ------------------------------------------------------------------ */
/*  Friends                                                            */
/* ------------------------------------------------------------------ */

const FRIEND_COLS = `
  *,
  requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}),
  addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLS})
`;

export async function listFriendships(userId: string): Promise<FriendEdge[]> {
  const res = await supabase
    .from('friendships')
    .select(FRIEND_COLS)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  return (unwrap(res) as FriendEdge[]) ?? [];
}

/** The person on the other end of a friendship row. */
export function otherPerson(edge: FriendEdge, meId: string): Profile | null {
  return edge.requester_id === meId ? edge.addressee : edge.requester;
}

export async function sendFriendRequest(meId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: meId, addressee_id: addresseeId, status: 'pending' });
  if (error) throw error;
}

export async function respondToFriendRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function removeFriendship(id: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Challenges                                                         */
/* ------------------------------------------------------------------ */

export async function listMyChallenges(userId: string): Promise<ChallengeWithPeople[]> {
  const res = await supabase
    .from('challenges')
    .select(CHALLENGE_WITH_PEOPLE)
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  return (unwrap(res) as ChallengeWithPeople[]) ?? [];
}

/** Public challenges still waiting for an opponent, excluding my own. */
export async function listOpenChallenges(userId: string): Promise<ChallengeWithPeople[]> {
  const res = await supabase
    .from('challenges')
    .select(CHALLENGE_WITH_PEOPLE)
    .eq('is_public', true)
    .eq('status', 'open')
    .is('opponent_id', null)
    .neq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (unwrap(res) as ChallengeWithPeople[]) ?? [];
}

export async function getChallenge(id: string): Promise<ChallengeWithPeople | null> {
  const res = await supabase.from('challenges').select(CHALLENGE_WITH_PEOPLE).eq('id', id).maybeSingle();
  return unwrap(res) as ChallengeWithPeople | null;
}

export interface NewChallenge {
  title: string;
  description: string | null;
  day_count: number;
  start_date: string;
  is_public: boolean;
  /** Applied to every single day of the challenge. */
  tasks: string[];
}

/**
 * Creates the challenge and seeds the same checklist onto every day, in one
 * transaction. Doing it server-side means a 30-day challenge with 4 tasks is
 * a single call rather than 120 inserts.
 */
export async function createChallenge(input: NewChallenge): Promise<Challenge> {
  const res = await supabase.rpc('create_challenge_with_tasks', {
    p_title: input.title,
    p_description: input.description,
    p_day_count: input.day_count,
    p_start_date: input.start_date,
    p_is_public: input.is_public,
    p_tasks: input.tasks,
  });
  return unwrap(res) as Challenge;
}

export async function deleteChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('challenges').delete().eq('id', id);
  if (error) throw error;
}

export async function joinChallenge(challengeId: string): Promise<Challenge> {
  const res = await supabase.rpc('join_challenge', { p_challenge_id: challengeId });
  return unwrap(res) as Challenge;
}

export async function joinChallengeByCode(code: string): Promise<Challenge> {
  const res = await supabase.rpc('join_challenge_by_code', { p_code: code });
  return unwrap(res) as Challenge;
}

export async function finalizeDueChallenges(): Promise<void> {
  await supabase.rpc('finalize_due_challenges');
}

/* ------------------------------------------------------------------ */
/*  Join requests                                                      */
/* ------------------------------------------------------------------ */

export async function requestToJoin(challengeId: string, message: string | null) {
  const res = await supabase.rpc('request_to_join', {
    p_challenge_id: challengeId,
    p_message: message,
  });
  return unwrap(res);
}

export async function respondToJoinRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_join_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function listJoinRequestsFor(challengeId: string): Promise<JoinRequestWithUser[]> {
  const res = await supabase
    .from('challenge_join_requests')
    .select(`*, profile:profiles!challenge_join_requests_user_id_fkey(${PROFILE_COLS})`)
    .eq('challenge_id', challengeId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return (unwrap(res) as JoinRequestWithUser[]) ?? [];
}

export async function listMyJoinRequests(userId: string): Promise<JoinRequestWithChallenge[]> {
  const res = await supabase
    .from('challenge_join_requests')
    .select('*, challenge:challenges!challenge_join_requests_challenge_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (unwrap(res) as JoinRequestWithChallenge[]) ?? [];
}

/* ------------------------------------------------------------------ */
/*  Days, tasks and ticks                                              */
/* ------------------------------------------------------------------ */

export async function listDays(challengeId: string): Promise<ChallengeDay[]> {
  const res = await supabase
    .from('challenge_days')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('day_number', { ascending: true });
  return (unwrap(res) as ChallengeDay[]) ?? [];
}

export async function listTasks(dayId: string): Promise<Task[]> {
  const res = await supabase
    .from('tasks')
    .select('*')
    .eq('day_id', dayId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  return (unwrap(res) as Task[]) ?? [];
}

export async function addTask(
  challengeId: string,
  dayId: string,
  title: string,
  position: number
): Promise<Task> {
  const res = await supabase
    .from('tasks')
    .insert({ challenge_id: challengeId, day_id: dayId, title: title.trim(), position })
    .select('*')
    .single();
  return unwrap(res) as Task;
}

export async function renameTask(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('tasks').update({ title: title.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/** Completions for a set of tasks, for *both* players. */
export async function listCompletions(taskIds: string[]): Promise<TaskCompletion[]> {
  if (taskIds.length === 0) return [];
  const res = await supabase.from('task_completions').select('*').in('task_id', taskIds);
  return (unwrap(res) as TaskCompletion[]) ?? [];
}

export async function setTaskDone(
  taskId: string,
  userId: string,
  challengeId: string,
  done: boolean
): Promise<void> {
  if (done) {
    const { error } = await supabase
      .from('task_completions')
      .upsert({ task_id: taskId, user_id: userId, challenge_id: challengeId }, { onConflict: 'task_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Productivity timer                                                 */
/* ------------------------------------------------------------------ */

export async function listFocusSessions(dayId: string): Promise<FocusSession[]> {
  const res = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('day_id', dayId)
    .order('created_at', { ascending: false });
  return (unwrap(res) as FocusSession[]) ?? [];
}

export async function logFocusSession(
  challengeId: string,
  dayId: string,
  userId: string,
  seconds: number,
  note: string | null
): Promise<FocusSession> {
  const res = await supabase
    .from('focus_sessions')
    .insert({
      challenge_id: challengeId,
      day_id: dayId,
      user_id: userId,
      seconds: Math.round(seconds),
      note: note?.trim() || null,
    })
    .select('*')
    .single();
  return unwrap(res) as FocusSession;
}

export async function deleteFocusSession(id: string): Promise<void> {
  const { error } = await supabase.from('focus_sessions').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export async function getDayProgress(challengeId: string): Promise<DayProgress[]> {
  const res = await supabase
    .from('challenge_day_progress')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('day_number', { ascending: true });
  return (unwrap(res) as DayProgress[]) ?? [];
}

export async function getLeaderboard(challengeId: string): Promise<LeaderboardRow[]> {
  const res = await supabase
    .from('challenge_leaderboard')
    .select('*')
    .eq('challenge_id', challengeId);
  return (unwrap(res) as LeaderboardRow[]) ?? [];
}

/* ------------------------------------------------------------------ */
/*  Invitations                                                        */
/* ------------------------------------------------------------------ */

export interface InvitePreview {
  challenge_id: string;
  title: string;
  description: string | null;
  day_count: number;
  start_date: string;
  end_date: string;
  status: string;
  creator_username: string;
  creator_display_name: string | null;
  has_opponent: boolean;
  i_am_creator: boolean;
}

/** Reads an invite by code, including private challenges RLS would hide. */
export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const res = await supabase.rpc('preview_invite', { p_code: code });
  const rows = (unwrap(res) as InvitePreview[]) ?? [];
  return rows[0] ?? null;
}

/** Leaderboard rows for many challenges at once, for list screens. */
export async function getLeaderboards(challengeIds: string[]): Promise<LeaderboardRow[]> {
  if (challengeIds.length === 0) return [];
  const res = await supabase
    .from('challenge_leaderboard')
    .select('*')
    .in('challenge_id', challengeIds);
  return (unwrap(res) as LeaderboardRow[]) ?? [];
}


/* ------------------------------------------------------------------ */
/*  Push tokens                                                        */
/* ------------------------------------------------------------------ */

/** Registers this device so the opponent's ticks can reach it. */
export async function savePushToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );
  if (error) throw error;
}

/** Drops this device's token, so a signed-out phone stops being notified. */
export async function removePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Today                                                              */
/* ------------------------------------------------------------------ */

export interface TodayEntry {
  challenge: ChallengeWithPeople;
  day: ChallengeDay;
  tasks: Task[];
  /** Task ids I have ticked. */
  myDone: Set<string>;
  rivalDone: Set<string>;
  /** Seconds logged today. */
  mySeconds: number;
  rivalSeconds: number;
  /** Seconds logged across the whole challenge. */
  myTotal: number;
  rivalTotal: number;
}

/**
 * Everything needed to tick today's boxes without opening a challenge.
 *
 * Batched rather than per-challenge: one round trip per table, filtered by
 * `in`, so a player in three challenges still costs six queries, not
 * eighteen.
 */
export async function getToday(userId: string): Promise<TodayEntry[]> {
  const mine = await listMyChallenges(userId);

  const today = todayKey();
  const live = mine.filter(
    (c) =>
      c.opponent_id &&
      c.status !== 'cancelled' &&
      c.start_date <= today &&
      c.end_date >= today
  );
  if (live.length === 0) return [];

  const ids = live.map((c) => c.id);

  const daysRes = await supabase
    .from('challenge_days')
    .select('*')
    .in('challenge_id', ids)
    .eq('day_date', today);
  const days = (unwrap(daysRes) as ChallengeDay[]) ?? [];
  if (days.length === 0) return [];

  const dayIds = days.map((d) => d.id);

  const [tasksRes, focusRes, boardRows] = await Promise.all([
    supabase.from('tasks').select('*').in('day_id', dayIds).order('position', { ascending: true }),
    supabase.from('focus_sessions').select('*').in('day_id', dayIds),
    getLeaderboards(ids),
  ]);

  const tasks = (unwrap(tasksRes) as Task[]) ?? [];
  const focus = (unwrap(focusRes) as FocusSession[]) ?? [];
  const completions = await listCompletions(tasks.map((t) => t.id));

  return live
    .map((challenge) => {
      const day = days.find((d) => d.challenge_id === challenge.id);
      if (!day) return null;

      const rivalId =
        challenge.creator_id === userId ? challenge.opponent_id : challenge.creator_id;

      const dayTasks = tasks.filter((t) => t.day_id === day.id);
      const taskIds = new Set(dayTasks.map((t) => t.id));

      const secondsFor = (uid: string | null) =>
        focus
          .filter((f) => f.day_id === day.id && f.user_id === uid)
          .reduce((sum, f) => sum + f.seconds, 0);

      const board = boardRows.filter((r) => r.challenge_id === challenge.id);

      return {
        challenge,
        day,
        tasks: dayTasks,
        myDone: new Set(
          completions.filter((c) => c.user_id === userId && taskIds.has(c.task_id)).map((c) => c.task_id)
        ),
        rivalDone: new Set(
          completions.filter((c) => c.user_id === rivalId && taskIds.has(c.task_id)).map((c) => c.task_id)
        ),
        mySeconds: secondsFor(userId),
        rivalSeconds: secondsFor(rivalId),
        myTotal: Number(board.find((r) => r.user_id === userId)?.total_seconds ?? 0),
        rivalTotal: Number(board.find((r) => r.user_id === rivalId)?.total_seconds ?? 0),
      } satisfies TodayEntry;
    })
    .filter((x): x is TodayEntry => x !== null);
}
