// Centralized config for event review thresholds

// Percentage (0-100) of speaking time vs session time
// Env: EVENT_MERIT_MIN_SPEAKING_PCT (preferred) or MERIT_MIN_SPEAKING_PCT
const MERIT_MIN_SPEAKING_PCT: number = (() => {
  const raw = process.env.EVENT_MERIT_MIN_SPEAKING_PCT ?? process.env.MERIT_MIN_SPEAKING_PCT;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return 20; // default 20%
})();

// Minimum presence percentage (0-100) of the total session time
// Env: EVENT_MERIT_MIN_PRESENT_PCT
const MERIT_MIN_PRESENT_PCT: number = (() => {
  const raw = process.env.EVENT_MERIT_MIN_PRESENT_PCT;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return 5; // default 5%
})();

// Optional overrides for testing that take precedence over per-type thresholds
// Env: EVENT_MERIT_MIN_SPEAKING_PCT_OVERRIDE, EVENT_MERIT_MIN_PRESENT_PCT_OVERRIDE
const MERIT_MIN_SPEAKING_PCT_OVERRIDE: number | undefined = (() => {
  const raw = process.env.EVENT_MERIT_MIN_SPEAKING_PCT_OVERRIDE;
  if (raw === undefined) return undefined;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return undefined;
})();

const MERIT_MIN_PRESENT_PCT_OVERRIDE: number | undefined = (() => {
  const raw = process.env.EVENT_MERIT_MIN_PRESENT_PCT_OVERRIDE;
  if (raw === undefined) return undefined;
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return undefined;
})();

export function getMeritMinSpeakingPct() {
  return MERIT_MIN_SPEAKING_PCT;
}

export function getMeritMinPresentPct() {
  return MERIT_MIN_PRESENT_PCT;
}

export function getMeritMinSpeakingPctOverride(): number | undefined {
  return MERIT_MIN_SPEAKING_PCT_OVERRIDE;
}

export function getMeritMinPresentPctOverride(): number | undefined {
  return MERIT_MIN_PRESENT_PCT_OVERRIDE;
}
