export type FriendStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeStatus = 'open' | 'active' | 'completed' | 'cancelled';
export type JoinRequestStatus = 'pending' | 'accepted' | 'declined';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
}

/** A friendship row joined with the *other* person's profile. */
export interface FriendEdge extends Friendship {
  requester: Profile | null;
  addressee: Profile | null;
}

export interface Challenge {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  title: string;
  description: string | null;
  day_count: number;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  is_public: boolean;
  invite_code: string;
  created_at: string;
}

export interface ChallengeWithPeople extends Challenge {
  creator: Profile | null;
  opponent: Profile | null;
}

export interface ChallengeDay {
  id: string;
  challenge_id: string;
  day_number: number;
  day_date: string;
}

export interface Task {
  id: string;
  challenge_id: string;
  day_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  user_id: string;
  challenge_id: string;
  completed_at: string;
}

export interface FocusSession {
  id: string;
  challenge_id: string;
  day_id: string;
  user_id: string;
  seconds: number;
  note: string | null;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  challenge_id: string;
  user_id: string;
  status: JoinRequestStatus;
  message: string | null;
  created_at: string;
}

export interface JoinRequestWithUser extends JoinRequest {
  profile: Profile | null;
}

export interface JoinRequestWithChallenge extends JoinRequest {
  challenge: Challenge | null;
}

/** Row of public.challenge_day_progress */
export interface DayProgress {
  challenge_id: string;
  day_id: string;
  day_number: number;
  day_date: string;
  user_id: string;
  total_tasks: number;
  completed_tasks: number;
  is_complete: boolean;
  focus_seconds: number;
}

/** Row of public.challenge_leaderboard */
export interface LeaderboardRow {
  challenge_id: string;
  user_id: string;
  role: 'creator' | 'opponent';
  total_seconds: number;
  days_complete: number;
  tasks_done: number;
  tasks_total: number;
}

/** Row returned by public.search_users() */
export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  friend_status: FriendStatus | null;
  friendship_id: string | null;
  i_requested: boolean | null;
}

export function displayNameOf(p: Pick<Profile, 'username' | 'display_name'> | null | undefined): string {
  if (!p) return 'Unknown';
  return p.display_name?.trim() || p.username;
}
