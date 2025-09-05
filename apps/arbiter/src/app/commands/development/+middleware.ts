import {MiddlewareContext, stopMiddlewares} from "commandkit";
import { MessageFlags } from "discord.js";

export async function beforeExecute(ctx: MiddlewareContext) {

    //This middleware runs before the get-users command is executed
    // @ts-ignore'
    // Filter out users who do not have the Server Staff Role
    if (!ctx.interaction.member.roles.cache.has('1364287451576930326')) {

        const {interaction} = ctx;

        if (interaction.isRepliable()) {
            await interaction.reply ({
                content: 'This command is only available to the server admins.',
                flags: MessageFlags.Ephemeral,
            })
        }

        console.log(`${ctx.commandName} will not be executed!`);
        stopMiddlewares()
    }
}
