import { ActivityType } from "discord.js";
import { Logger } from "commandkit/logger";

//#region src/app/events/clientReady/log.ts
const handler = async (client) => {
	Logger.info(`Logged in as ${client.user.username}!`);
	client.user.setPresence({
		activities: [{
			name: "the Legion",
			type: ActivityType.Watching
		}],
		status: "online"
	});
};
var log_default = handler;

//#endregion
export { log_default as default };
//# sourceMappingURL=log.js.map