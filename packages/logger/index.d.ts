import type { Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export declare const logger: Logger;
export declare function childLogger(bindings: Record<string, unknown>): Logger;
export declare function forInteraction(i: { guildId?: string | null; user?: { id?: string }; commandName?: string; id?: string }): Logger;
