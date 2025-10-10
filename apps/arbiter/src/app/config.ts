// Centralized configuration and constants for Arbiter

export const CONFIG = {
  // Primary roles (from DiscordRoles.csv role_id/name)
  // Server Staff
  STAFF_ROLE_ID: process.env.STAFF_ROLE_ID ?? "1364287451576930326", // "Server Staff"
  // Alias for clarity in some modules
  SERVER_STAFF_ROLE_ID: process.env.SERVER_STAFF_ROLE_ID ?? (process.env.STAFF_ROLE_ID ?? "1364287451576930326"),
  // Legionnaire (general member)
  LEGIONNAIRE_ROLE_ID: process.env.LEGIONNAIRE_ROLE_ID ?? "1352350908385853541", // "Legionnaire"
  // Centurion (event leaders)
  CENTURION_ROLE_ID: process.env.CENTURION_ROLE_ID ?? "1352378365809786970", // "Centurion"
  // Tech roles used in pings (prod)
  TECH_LEAD_ROLE_ID: process.env.TECH_LEAD_ROLE_ID ?? "1378474882811170938", // "Tech Lead"
  DECANUS_ROLE_ID: process.env.DECANUS_ROLE_ID ?? "1302658626795733013", // "Decanus (Security)"

  // Division roles referenced by code (get-users export filter)
  SELECTED_DIVISION_ROLE_IDS: [
    "1356438908212088863", // Division: H.A.L.O.
    "1356438093988757686", // Division: V.A.N.G.U.A.R.D.
    "1356438285592825989", // Division: S.P.E.A.R.
    "1362489356958437477", // Division: H.A.V.O.K.
    "1356438213438472323", // Division: R.A.F.T.
    "1356458993056485477", // Division: D.R.I.L.L.
    "1356459074392162414", // Division: S.C.R.A.P.
    "1356459107955118110", // Division: L.O.G.I.
    "1356459145762574516", // Division: T.R.A.D.E.
    "1356459183548923965", // Division: A.R.C.H.
  ],
  DEV_BYPASS: (process.env.DEV_BYPASS_MIDDLEWARE ?? "false").toLowerCase() === "true",
  ENV: (process.env.ENVIRONMENT || process.env.NODE_ENV || "production").toLowerCase(),
};

export const isDev = () => ["dev", "development", "local"].includes(CONFIG.ENV);
