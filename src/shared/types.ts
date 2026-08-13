export const CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"] as const;

export type PlayerView = {
  id: string;
  name: string;
  hasVoted: boolean;
  vote: string | null;
};

export type LinkedIssue = {
  issueId: string;
  identifier: string;
  title: string;
  url: string;
  savedEstimate: number | null;
};

export type RoomState = {
  id: string;
  topic: string;
  revealed: boolean;
  players: PlayerView[];
  issue: LinkedIssue | null;
  linearReady: boolean;
};
