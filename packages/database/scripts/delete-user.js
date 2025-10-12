// Delete a specific user and all related records
// Usage: node ./scripts/delete-user.js <userId>
// Set CONFIRM_DELETE=1 to actually delete, otherwise runs in dry-run mode
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const main = async () => {
    const userId = process.argv[2];
    const DRY_RUN = String(process.env.CONFIRM_DELETE ?? '') !== '1';
    
    if (!userId) {
        console.error("Usage: node delete-user.js <userId>");
        console.error("Example: node delete-user.js 123456789012345678");
        console.error("Set CONFIRM_DELETE=1 to actually delete (otherwise dry-run)");
        process.exit(1);
    }
    
    console.log(`[Delete User] Starting (userId=${userId}, dryRun=${DRY_RUN ? 'yes' : 'no'})`);
    
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.log(`[Delete User] User ${userId} not found.`);
        return;
    }
    
    console.log(`[Delete User] Found user: ${user.username || user.nickname || user.name || userId}`);
    
    // Find all related records that would be deleted
    const merits = await prisma.merit.findMany({ where: { userID: userId } });
    const divisionMemberships = await prisma.divisionMembership.findMany({ where: { userId } });
    const nameChangeRequests = await prisma.nameChangeRequest.findMany({ where: { userId } });
    const eventSessionParticipants = await prisma.eventSessionParticipant.findMany({ where: { userId } });
    const accounts = await prisma.account.findMany({ where: { userId } });
    const sessions = await prisma.session.findMany({ where: { userId } });
    
    console.log(`[Delete User] Related records found:`);
    console.log(`  - Merits: ${merits.length}`);
    console.log(`  - Division Memberships: ${divisionMemberships.length}`);
    console.log(`  - Name Change Requests: ${nameChangeRequests.length}`);
    console.log(`  - Event Session Participants: ${eventSessionParticipants.length}`);
    console.log(`  - Accounts: ${accounts.length}`);
    console.log(`  - Sessions: ${sessions.length}`);
    
    if (DRY_RUN) {
        console.log(`[Delete User] DRY RUN - Would delete user ${userId} and all related records above.`);
        console.log(`[Delete User] Run with CONFIRM_DELETE=1 to actually delete.`);
        return;
    }
    
    // Delete in order to respect foreign key constraints
    console.log(`[Delete User] Deleting related records...`);
    
    // Delete merits (foreign key to user)
    if (merits.length > 0) {
        const deletedMerits = await prisma.merit.deleteMany({ where: { userID: userId } });
        console.log(`[Delete User] Deleted ${deletedMerits.count} merit records`);
    }
    
    // Delete division memberships (foreign key to user)
    if (divisionMemberships.length > 0) {
        const deletedMemberships = await prisma.divisionMembership.deleteMany({ where: { userId } });
        console.log(`[Delete User] Deleted ${deletedMemberships.count} division membership records`);
    }
    
    // Delete name change requests (foreign key to user)
    if (nameChangeRequests.length > 0) {
        const deletedRequests = await prisma.nameChangeRequest.deleteMany({ where: { userId } });
        console.log(`[Delete User] Deleted ${deletedRequests.count} name change request records`);
    }
    
    // Delete event session participants (foreign key to user)
    if (eventSessionParticipants.length > 0) {
        const deletedParticipants = await prisma.eventSessionParticipant.deleteMany({ where: { userId } });
        console.log(`[Delete User] Deleted ${deletedParticipants.count} event session participant records`);
    }
    
    // Delete accounts (foreign key to user)
    if (accounts.length > 0) {
        const deletedAccounts = await prisma.account.deleteMany({ where: { userId } });
        console.log(`[Delete User] Deleted ${deletedAccounts.count} account records`);
    }
    
    // Delete sessions (foreign key to user)
    if (sessions.length > 0) {
        const deletedSessions = await prisma.session.deleteMany({ where: { userId } });
        console.log(`[Delete User] Deleted ${deletedSessions.count} session records`);
    }
    
    // Finally, delete the user
    await prisma.user.delete({ where: { id: userId } });
    console.log(`[Delete User] Deleted user ${userId}`);
    
    console.log(`[Delete User] Successfully deleted user and all related records.`);
};

main()
    .catch((err) => {
        console.error("[Delete User] Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });