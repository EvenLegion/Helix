export type ReviewChoice = "merit" | "none";

type ReviewState = {
  selections: Map<string, ReviewChoice>; // userId -> choice
};

const store = new Map<string, ReviewState>();

export function getReviewStateKey(sessionId: number, reviewerId: string) {
  return `${sessionId}:${reviewerId}`;
}

export function upsertReviewState(key: string, defaults?: Map<string, ReviewChoice>) {
  let s = store.get(key);
  if (!s) {
    s = { selections: new Map() };
    store.set(key, s);
  }
  if (defaults) {
    for (const [uid, choice] of defaults) {
      if (!s.selections.has(uid)) s.selections.set(uid, choice);
    }
  }
  return s;
}

export function setSelection(key: string, userId: string, choice: ReviewChoice) {
  const s = upsertReviewState(key);
  s.selections.set(userId, choice);
}

export function getSelection(key: string, userId: string): ReviewChoice {
  const s = store.get(key);
  return s?.selections.get(userId) ?? "none";
}

export function getAllSelections(key: string): Array<{ userId: string; choice: ReviewChoice }> {
  const s = store.get(key);
  if (!s) return [];
  return Array.from(s.selections.entries()).map(([userId, choice]) => ({ userId, choice }));
}

export function clearReviewState(key: string) {
  store.delete(key);
}
