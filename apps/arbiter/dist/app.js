import { Client } from "discord.js";
import { prisma } from "@workspace/db";

//#region src/app.ts
const client = new Client({ intents: [
	"Guilds",
	"GuildMembers",
	"GuildMessages",
	"MessageContent",
	"GuildMessageReactions",
	"GuildVoiceStates"
] });
var app_default = client;
const isOn = (v) => [
	"1",
	"true",
	"on",
	"yes"
].includes(String(v ?? "").toLowerCase());
isOn(process.env.PRISMA_WARMUP || process.env.PRISMA_LOG_EVENTS || process.env.PRISMA_LOG_MW);

//#endregion
export { app_default as default };
//# sourceMappingURL=app.js.map