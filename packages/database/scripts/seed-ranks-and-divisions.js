/* Seed 1..40 RankLevel and core Divisions */
import { PrismaClient } from "../generated/prisma/index.js";
const prisma = new PrismaClient();

const CUMULATIVE = [
  1, 3, 7, 12, 18, 25, 33, 42, 52, 63, 75, 88, 102, 117, 133, 150, 168, 187,
  207, 207, 221, 236, 252, 269, 287, 307, 329, 353, 379, 407, 422, 439, 458,
  479, 502, 527, 554, 583, 614, 614,
];

const divisions = [
  ["LGN", "Legionnaire", "general", true, "LGN | ", null, null],
  ["HLO", "H.A.L.O.", "combat", true, "HLO | ", "HALO_Emblem", "1370272683165749421"],
  [
    "VNG",
    "V.A.N.G.U.A.R.D.",
    "combat",
    true,
    "VNG | ",
    "VANG_Emblem",
    "1370272690623217664",
  ],
  ["SPR", "S.P.E.A.R.", "combat", true, "SPR | ", "SPR_Emblem", "1370272692267389018"],
  ["HVK", "H.A.V.O.K.", "combat", true, "HVK | ", "HVK_Emblem", "1370272695308259398"],
  ["RFT", "R.A.F.T.", "combat", true, "RFT | ", "RAFT_Emblem", "1374196910151176273"],
  ["RPR", "R.E.A.P.E.R.", "combat", true, "RPR | ", null, null],
  [
    "DRL",
    "D.R.I.L.L.",
    "industrial",
    true,
    "DRL | ",
    "DRILL_Emblem",
    "1370272685678002266",
  ],
  [
    "SCR",
    "S.C.R.A.P.",
    "industrial",
    true,
    "SCR | ",
    "SCRAP_Emblem",
    "1370272687657844856",
  ],
  [
    "LOG",
    "L.O.G.I.",
    "industrial",
    true,
    "LOG | ",
    "LOGI_Emblem",
    "1370272686621724672",
  ],
  [
    "TRD",
    "T.R.A.D.E.",
    "industrial",
    true,
    "TRD | ",
    "TRADE_Emblem",
    "1370272689599811655",
  ],
  [
    "ARC",
    "A.R.C.H.",
    "industrial",
    true,
    "ARC | ",
    "ARCH_Emblem",
    "1370272684683825192",
  ],
  ["SEC", "Security", "staff", false, "SEC | ", null, null],
  ["ADMR", "Admiral", "staff", false, "ADMR | ", null, null],
  ["CMDR", "Commander", "staff", false, "CMDR | ", null, null],
  ["TECH", "Tech Dept.", "staff", false, "TECH | ", null, null],
  ["EXEC", "Executive", "staff", false, "EXEC | ", null, null],
];

async function main() {
  for (let i = 1; i <= 40; i++) {
    await prisma.rankLevel.upsert({
      where: { level: i },
      update: { cumulativeMerits: CUMULATIVE[i - 1] },
      create: { level: i, cumulativeMerits: CUMULATIVE[i - 1] },
    });
  }
  for (const [
    code,
    name,
    kind,
    showRank,
    nicknamePrefix,
    emojiName,
    emojiId,
  ] of divisions) {
    await prisma.division.upsert({
      where: { code },
      update: { name, kind, showRank, nicknamePrefix, emojiName, emojiId },
      create: {
        code,
        name,
        kind,
        showRank,
        nicknamePrefix,
        emojiName,
        emojiId,
      },
    });
  }
  console.log("Seeded RankLevel(1..40) and divisions.");
}

main().finally(() => prisma.$disconnect());
