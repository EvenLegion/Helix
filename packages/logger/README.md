# @workspace/logger

Shared Pino logger with sensible defaults for apps in this monorepo.

## Usage

- Import helpers:
  - `logger`: base logger (JSON in prod, pretty in dev)
  - `childLogger(bindings)`: derive a contextual logger
  - `forInteraction(interaction)`: child logger with Discord interaction context (guildId, userId, command, interactionId)

Example (Command/Interaction):

```ts
import { forInteraction } from "@workspace/logger";

export async function handler(interaction: Interaction) {
  const log = forInteraction(interaction).child({ mod: "feature", action: "doThing" });
  log.debug({ foo: "bar" }, "Starting");
  try {
    // ...work
    log.debug({ result: 123 }, "Completed");
  } catch (err) {
    log.error({ err }, "Failed");
  }
}
```

Example (Service):

```ts
import { childLogger } from "@workspace/logger";
const log = childLogger({ mod: "service", sub: "worker" });
log.debug("tick");
```

## Levels

- debug: normal flow, metrics, non-critical details
- warn: guard checks, recoverable issues, missing optional data/permissions
- error: failures/exceptions

## Env vars

- `NODE_ENV`: selects pretty transport (non-prod) or JSON (prod)
- `LOG_LEVEL`: overrides default level (defaults: debug in dev, info in prod)
- `APP_NAME`: included in log base fields (defaults to `app`)

## Notes

- Pretty printing uses `pino-pretty` automatically in non-production environments if available; otherwise falls back to JSON.
- Prefer `forInteraction` where an Interaction is available to enrich logs.
