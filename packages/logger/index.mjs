import pino from "pino";

function isProd() {
    return process.env.NODE_ENV === "production";
}

function createTransport() {
    if (isProd()) return undefined;
    // Allow disabling pretty transport explicitly
    if (String(process.env.LOG_PRETTY || "1").toLowerCase() in { "0": 1, "false": 1, "no": 1, "off": 1 }) {
        return undefined;
    }
    try {
        return pino.transport({
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:HH:MM:ss.l",
                singleLine: true,
                levelFirst: true,
                // On Windows, force CRLF to avoid odd wrapping in some terminals
                crlf: process.platform === "win32",
            },
        });
    } catch (_e) {
        return undefined;
    }
}

function createDestination() {
    // Optional: direct logs to stderr or to a file; can also force sync writes
    const sync = String(process.env.LOG_SYNC || "").toLowerCase() in { "1": 1, "true": 1, "on": 1, "yes": 1 };
    const logFile = process.env.LOG_FILE;
    const dest = process.env.LOG_DEST; // "stdout" | "stderr"
    if (logFile) {
        try {
            return pino.destination({ dest: logFile, mkdir: true, sync });
        } catch (_e) {
            // fall through to console
        }
    }
    if ((dest || "").toLowerCase() === "stderr") {
        return pino.destination({ dest: 2, sync });
    }
    if (sync) {
        return pino.destination({ dest: 1, sync });
    }
    return undefined;
}

function createBaseLogger(bindings) {
    const level = process.env.LOG_LEVEL || (isProd() ? "info" : "debug");
    // If a destination is configured, prefer that. Otherwise, use pretty transport in non-prod.
    const destination = createDestination();
    const transport = destination ? undefined : createTransport();
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
        destination || transport
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
