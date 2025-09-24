// Centralized config for event review thresholds

export type MeritScoreMode = 'speaking_over_present' | 'speaking_over_session' | 'dual_thresholds';

// Percentage (0-100) of speaking time vs present time (or session time depending on mode)
// Env: EVENT_MERIT_MIN_SPEAKING_PCT (preferred) or MERIT_MIN_SPEAKING_PCT
const MERIT_MIN_SPEAKING_PCT: number = (() => {
  const raw = process.env.EVENT_MERIT_MIN_SPEAKING_PCT ?? process.env.MERIT_MIN_SPEAKING_PCT;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return 20; // default 20%
})();

// Additional minimum presence percentage (0-100) of the total session time, used in dual_thresholds mode
// Env: EVENT_MERIT_MIN_PRESENT_PCT
const MERIT_MIN_PRESENT_PCT: number = (() => {
  const raw = process.env.EVENT_MERIT_MIN_PRESENT_PCT;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return 5; // default 5%
})();

// Mode controlling how we score/sort and how thresholds are applied
// Env: EVENT_MERIT_SCORE_MODE: 'speaking_over_present' | 'speaking_over_session' | 'dual_thresholds'
const MERIT_SCORE_MODE: MeritScoreMode = (() => {
  const raw = String(process.env.EVENT_MERIT_SCORE_MODE || '').toLowerCase();
  if (raw === 'speaking_over_session') return 'speaking_over_session';
  if (raw === 'dual_thresholds') return 'dual_thresholds';
  return 'dual_thresholds';
})();

export function getMeritMinSpeakingPct() {
  return MERIT_MIN_SPEAKING_PCT;
}

export function getMeritMinPresentPct() {
  return MERIT_MIN_PRESENT_PCT;
}

export function getMeritScoreMode(): MeritScoreMode {
  return MERIT_SCORE_MODE;
}
