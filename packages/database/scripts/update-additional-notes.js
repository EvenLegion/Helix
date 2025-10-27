import { prisma } from "@workspace/db";

async function fixArbiterImportDuplicates() {
  console.log("Starting to fix 'Arbiter Import', empty, and null duplicates...\n");

  // Find all merits with "Arbiter Import", empty string, or null in additionalNotes
  const meritsToFix = await prisma.merit.findMany({
    where: {
      OR: [
        { additionalNotes: "Arbiter Import" },
        { additionalNotes: "" },
        { additionalNotes: " " },
        { additionalNotes: null },
      ],
    },
    orderBy: {
      createdAt: "asc", // Process oldest first
    },
  });

  console.log(`Found ${meritsToFix.length} merits to fix\n`);

  if (meritsToFix.length === 0) {
    console.log("No duplicates to fix!");
    return;
  }

  // Group by original value for separate counters
  const arbiterImports = meritsToFix.filter(m => m.additionalNotes === "Arbiter Import");
  const emptyStrings = meritsToFix.filter(m => m.additionalNotes === "" || m.additionalNotes === " ");
  const nullValues = meritsToFix.filter(m => m.additionalNotes === null);

  let updatedCount = 0;

  // Update "Arbiter Import" entries
  console.log(`Processing ${arbiterImports.length} "Arbiter Import" entries...`);
  for (let i = 0; i < arbiterImports.length; i++) {
    const merit = arbiterImports[i];
    const newAdditionalNotes = `Arbiter Import${i + 1}`;

    try {
      await prisma.merit.update({
        where: { id: merit.id },
        data: { additionalNotes: newAdditionalNotes },
      });

      console.log(
        `✓ Updated Merit ID ${merit.id} → "${newAdditionalNotes}" (User: ${merit.userID})`
      );
      updatedCount++;
    } catch (error) {
      console.error(`✗ Failed to update Merit ID ${merit.id}:`, error);
    }
  }

  // Update empty string entries
  console.log(`\nProcessing ${emptyStrings.length} empty string entries...`);
  for (let i = 0; i < emptyStrings.length; i++) {
    const merit = emptyStrings[i];
    const newAdditionalNotes = `Empty${i + 1}`;

    try {
      await prisma.merit.update({
        where: { id: merit.id },
        data: { additionalNotes: newAdditionalNotes },
      });

      console.log(
        `✓ Updated Merit ID ${merit.id} → "${newAdditionalNotes}" (User: ${merit.userID})`
      );
      updatedCount++;
    } catch (error) {
      console.error(`✗ Failed to update Merit ID ${merit.id}:`, error);
    }
  }

  // Update null entries
  console.log(`\nProcessing ${nullValues.length} null entries...`);
  for (let i = 0; i < nullValues.length; i++) {
    const merit = nullValues[i];
    const newAdditionalNotes = `Null${i + 1}`;

    try {
      await prisma.merit.update({
        where: { id: merit.id },
        data: { additionalNotes: newAdditionalNotes },
      });

      console.log(
        `✓ Updated Merit ID ${merit.id} → "${newAdditionalNotes}" (User: ${merit.userID})`
      );
      updatedCount++;
    } catch (error) {
      console.error(`✗ Failed to update Merit ID ${merit.id}:`, error);
    }
  }

  console.log(`\n✅ Successfully updated ${updatedCount} of ${meritsToFix.length} merits`);
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
