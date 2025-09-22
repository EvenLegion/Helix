import pino from "pino";

function isProd() {
    return process.env.NODE_ENV === "production";
}

function createTransport() {
    if (isProd()) return undefined;
    try {
        return pino.transport({
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:HH:MM:ss.l",
                singleLine: true,
                levelFirst: true,
            },
        });
    } catch (_e) {
        return undefined;
    }
}

function createBaseLogger(bindings) {
    const level = process.env.LOG_LEVEL || (isProd() ? "info" : "debug");
    const transport = createTransport();
    return pino(
        {
            level,
            base: { app: process.env.APP_NAME || "app", ...bindings },
            messageKey: "msg",
            formatters: {
                level(label) {
                    return { level: label };
                },
            },
        },
        transport
    );
}

export const logger = createBaseLogger();

export function childLogger(bindings) {
    return logger.child(bindings || {});
}

export function forInteraction(i) {
    return childLogger({
        guildId: (i && (i.guildId || (i.guild && i.guild.id))) || "dm",
        userId: i && i.user && i.user.id,
        cmd: i && (i.commandName || (i.command && i.command.name)),
        interactionId: i && i.id,
    });
}
