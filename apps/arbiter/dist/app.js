import { Client } from "discord.js";

//#region src/app.ts
const client = new Client({ intents: [
	"Guilds",
	"GuildMembers",
	"GuildMessages",
	"MessageContent",
	"GuildMessageReactions"
] });
var app_default = client;

//#endregion
export { app_default as default };
//# sourceMappingURL=app.js.map