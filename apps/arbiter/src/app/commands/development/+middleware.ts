// import {MiddlewareContext, stopMiddlewares} from "commandkit";
// import { MessageFlags } from "discord.js";
//
// export async function beforeExecute(ctx: MiddlewareContext) {
//
//     //This middleware runs before the get-users command is executed
//     // @ts-ignore
//     if (ctx.interaction.member.permissions.has('Administrator')) {
//
//         const {interaction} = ctx;
//
//         if (interaction.isRepliable()) {
//             await interaction.reply ({
//                 content: 'This command can only be used in a server.',
//                 flags: MessageFlags.Ephemeral,
//             })
//         }
//
//         console.log(`${ctx.commandName} will not be executed!`);
//         stopMiddlewares()
//     }
// }