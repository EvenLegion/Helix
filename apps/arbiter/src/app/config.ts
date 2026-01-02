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

  DEV_BYPASS: (process.env.DEV_BYPASS_MIDDLEWARE ?? "false").toLowerCase() === "true",
  ENV: (process.env.ENVIRONMENT || process.env.NODE_ENV || "production").toLowerCase(),
};

export const isDev = () => ["dev", "development", "local"].includes(CONFIG.ENV);

// Division role mapping indexed by kind
export const DIVISION_ROLES = isDev() ? {
  // Development division roles
  combat: {
    HLO: process.env.DEV_HALO_ROLE_ID ?? "", // H.A.L.O. (dev)
    VNG: process.env.DEV_VANGUARD_ROLE_ID ?? "", // V.A.N.G.U.A.R.D. (dev)
    SPR: process.env.DEV_SPEAR_ROLE_ID ?? "", // S.P.E.A.R. (dev)
    HVK: process.env.DEV_HAVOK_ROLE_ID ?? "", // H.A.V.O.K. (dev)
    RFT: process.env.DEV_RAFT_ROLE_ID ?? "", // R.A.F.T. (dev)
  },
  industrial: {
    DRL: process.env.DEV_DRILL_ROLE_ID ?? "", // D.R.I.L.L. (dev)
    SCR: process.env.DEV_SCRAP_ROLE_ID ?? "", // S.C.R.A.P. (dev)
    LOG: process.env.DEV_LOGI_ROLE_ID ?? "", // L.O.G.I. (dev)
    TRD: process.env.DEV_TRADE_ROLE_ID ?? "", // T.R.A.D.E. (dev)
    ARC: process.env.DEV_ARCH_ROLE_ID ?? "", // A.R.C.H. (dev)
  },
} as const : {
  // Production division roles
  combat: {
    HLO: "1356438908212088863", // H.A.L.O.
    VNG: "1356438093988757686", // V.A.N.G.U.A.R.D.
    SPR: "1356438285592825989", // S.P.E.A.R.
    HVK: "1362489356958437477", // H.A.V.O.K.
    RFT: "1356438213438472323", // R.A.F.T.
  },
  industrial: {
    DRL: "1356458993056485477", // D.R.I.L.L.
    SCR: "1356459074392162414", // S.C.R.A.P.
    LOG: "1356459107955118110", // L.O.G.I.
    TRD: "1356459145762574516", // T.R.A.D.E.
    ARC: "1356459183548923965", // A.R.C.H.
  },
} as const;
