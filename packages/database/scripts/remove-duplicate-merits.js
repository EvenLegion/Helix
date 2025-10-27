import { prisma } from "@workspace/db";

async function removeMeritDuplicates() {
  console.log("Starting to remove duplicate merits based on userId, typeId, and additionalNotes...\n");

  // Find all merits grouped by the unique constraint fields
  const allMerits = await prisma.merit.findMany({
    orderBy: {
      createdAt: "asc", // Oldest first
    },
  });

  console.log(`Found ${allMerits.length} total merits\n`);

  // Group merits by the combination of userId, typeId, and additionalNotes
  const groupedMerits = new Map();

  for (const merit of allMerits) {
    // Create a key from the unique constraint fields
    // Handle null additionalNotes by using a placeholder
    const key = `${merit.userID}|${merit.typeId}|${merit.additionalNotes ?? "NULL"}`;

    if (!groupedMerits.has(key)) {
      groupedMerits.set(key, []);
    }
    groupedMerits.get(key).push(merit);
  }

  console.log(`Found ${groupedMerits.size} unique combinations\n`);

  // Find groups with duplicates
  const duplicateGroups = Array.from(groupedMerits.entries())
    .filter(([_, merits]) => merits.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("No duplicates found!");
    return;
  }

  console.log(`Found ${duplicateGroups.length} groups with duplicates\n`);

  let totalDuplicates = 0;
  let deletedCount = 0;

  for (const [key, merits] of duplicateGroups) {
    const [userId, typeId, additionalNotes] = key.split("|");
    const displayNotes = additionalNotes === "NULL" ? "(null)" : additionalNotes;

    console.log(`\n📋 Group: User ${userId}, Type ${typeId}, Notes: "${displayNotes}"`);
    console.log(`   Found ${merits.length} duplicates (keeping oldest, deleting ${merits.length - 1})`);

    totalDuplicates += merits.length - 1;

    // Keep the first (oldest) merit, delete the rest
    const [keepMerit, ...deleteMerits] = merits;

    console.log(`   ✓ Keeping Merit ID ${keepMerit.id} (created: ${keepMerit.createdAt.toISOString()})`);

    for (const merit of deleteMerits) {
      try {
        await prisma.merit.delete({
          where: { id: merit.id },
        });

        console.log(`   ✗ Deleted Merit ID ${merit.id} (created: ${merit.createdAt.toISOString()})`);
        deletedCount++;
      } catch (error) {
        console.error(`   ❌ Failed to delete Merit ID ${merit.id}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Successfully deleted ${deletedCount} of ${totalDuplicates} duplicate merits`);
  console.log(`📊 Summary:`);
  console.log(`   - Total merits processed: ${allMerits.length}`);
  console.log(`   - Unique combinations: ${groupedMerits.size}`);
  console.log(`   - Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`   - Duplicates deleted: ${deletedCount}`);
  console.log(`   - Remaining merits: ${allMerits.length - deletedCount}`);
}

// Run the script
removeMeritDuplicates()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
