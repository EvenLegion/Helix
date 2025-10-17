export type RankEntry = {
  userId: string;
  displayName: string; // label to show in UI
  before: string;      // current nickname/display
  after: string;       // computed new nickname
  willChange: boolean; // before !== after
};

export type RankReviewMeta = {
  mode: "single" | "bulk";
  divisionCode?: string; // present when mode=single and user chose a division override
  total: number;
  page: number;
};

export type RankReviewState = {
  entries: RankEntry[];
  meta: RankReviewMeta;
};

const store = new Map<string, RankReviewState>();

export function makeKey(scope: string) {
  return scope; // scope format: `${scopeId}:${reviewerId}` – flexible per caller
}

export function setState(key: string, state: RankReviewState) {
  store.set(key, state);
}

export function getState(key: string): RankReviewState | undefined {
  return store.get(key);
}

export function clearState(key: string) {
  store.delete(key);
}

export function updatePage(key: string, page: number) {
  const s = store.get(key);
  if (!s) return;
  s.meta.page = Math.max(0, page);
}
