/* Seed 1..40 RankLevel and core Divisions */
import { PrismaClient } from "../generated/prisma/index.js";
const prisma = new PrismaClient();

const CUMULATIVE = [
    1, 3, 7, 12, 18, 25, 33, 42, 52, 63,
    75, 88, 102, 117, 133, 150, 168, 187, 207, 207,
    221, 236, 252, 269, 287, 307, 329, 353, 379, 407,
    422, 439, 458, 479, 502, 527, 554, 583, 614, 614,
];

const divisions = [
    ["LGN", "Legionnaire", "general", true, "LGN | "],
    ["HLO", "H.A.L.O.", "combat", true, "HLO | "],
    ["VNG", "V.A.N.G.U.A.R.D.", "combat", true, "VNG | "],
    ["SPR", "S.P.E.A.R.", "combat", true, "SPR | "],
    ["HVK", "H.A.V.O.K.", "combat", true, "HVK | "],
    ["RFT", "R.A.F.T.", "combat", true, "RFT | "],
    ["DRL", "D.R.I.L.L.", "industrial", false, "DRL | "],
    ["SCR", "S.C.R.A.P.", "industrial", false, "SCR | "],
    ["LOG", "L.O.G.I.", "industrial", false, "LOG | "],
    ["TRD", "T.R.A.D.E.", "industrial", false, "TRD | "],
    ["ARC", "A.R.C.H.", "industrial", false, "ARC | "],
    ["RPR", "R.E.A.P.E.R.", "combat", true, "RPR | "],
];

async function main() {
    for (let i = 1; i <= 40; i++) {
        await prisma.rankLevel.upsert({
            where: { level: i },
            update: { cumulativeMerits: CUMULATIVE[i - 1] },
            create: { level: i, cumulativeMerits: CUMULATIVE[i - 1] },
        });
    }
    for (const [code, name, kind, showRank, nicknamePrefix] of divisions) {
        await prisma.division.upsert({
            where: { code },
            update: { name, kind, showRank, nicknamePrefix },
            create: { code, name, kind, showRank, nicknamePrefix },
        });
    }
    console.log("Seeded RankLevel(1..40) and divisions.");
}

main().finally(() => prisma.$disconnect());
