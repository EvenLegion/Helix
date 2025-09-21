import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";

//#region src/app/commands/development/updateUserDB.ts
const command = {
	name: "import-users",
	description: "Updates the user database with the latest information.\""
};
async function chatInput({ interaction }) {
	const guild = interaction.guild;
	if (!guild) return interaction.reply({
		content: "This command can only be used in a server.",
		flags: MessageFlags.Ephemeral
	});
	const ROLE_ID = "1352350908385853541";
	await guild.members.fetch();
	const filteredMembers = guild.members.cache.filter((member) => member.roles.cache.has(ROLE_ID)).map((member) => ({
		user_id: member.user.id,
		guild_id: member.guild.id,
		username: member.user.username,
		nickname: member.nickname || null,
		roles: member.roles.cache
	}));
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		for (const member of filteredMembers) await prisma.user.upsert({
			where: { id: member.user_id },
			update: {
				username: member.username,
				nickname: member.nickname || " "
			},
			create: {
				id: member.user_id,
				username: member.username,
				nickname: member.nickname || " ",
				email: " ",
				emailVerified: false,
				name: " ",
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date()
			}
		});
		await interaction.editReply({ content: "User database has been updated with the latest information." });
	} catch (error) {
		console.log(`Error updating user database: ${error}`);
		await interaction.editReply({ content: `There was an error updating the user database: ${error}` });
	}
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=updateUserDB.js.map