import { prisma } from "@workspace/db";

async function fixArbiterImportDuplicates() {
  console.log("Starting to fix 'Arbiter Import' duplicates...\n");

  // Find all merits with "Arbiter Import" in additionalNotes
  const arbiterImports = await prisma.merit.findMany({
    where: {
      additionalNotes: "Arbiter Import",
    },
    orderBy: {
      createdAt: "asc", // Process oldest first
    },
  });

  console.log(`Found ${arbiterImports.length} merits with "Arbiter Import"\n`);

  if (arbiterImports.length === 0) {
    console.log("No duplicates to fix!");
    return;
  }

  let counter = 1;
  let updatedCount = 0;

  for (const merit of arbiterImports) {
    const newAdditionalNotes = `Arbiter Import${counter}`;

    try {
      await prisma.merit.update({
        where: { id: merit.id },
        data: { additionalNotes: newAdditionalNotes },
      });

      console.log(
        `✓ Updated Merit ID ${merit.id} → "${newAdditionalNotes}" (User: ${merit.userID})`
      );
      updatedCount++;
      counter++;
    } catch (error) {
      console.error(`✗ Failed to update Merit ID ${merit.id}:`, error);
    }
  }

  console.log(`\n✅ Successfully updated ${updatedCount} of ${arbiterImports.length} merits`);
}

// Run the script
fixArbiterImportDuplicates()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
