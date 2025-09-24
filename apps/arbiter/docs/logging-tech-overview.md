# Logging — Technical overview

Purpose: Describe the shared logging approach and how it is used across Arbiter.

Last updated: 2025-09-24

## Package

- `packages/logger`
  - Exports ESM and CJS entrypoints.
  - Pretty printing enabled automatically in non-production using `pino-pretty`.
  - Exports:
    - `logger`: base Pino logger
    - `childLogger(bindings)`: derive contextual loggers
    - `forInteraction(interaction)`: interaction-scoped child logger with guildId, userId, command, interactionId

## Usage patterns

- Commands/Interactions:
  - `const log = forInteraction(interaction).child({ mod: 'feature', action: 'sub' })`
- Services/Watchers:
  - `const log = childLogger({ mod: 'service', sessionId, guildId, channelId })`

## Level conventions

- `debug`: normal flow, decisions, metrics
- `warn`: guard checks, recoverable or expected-but-not-ideal conditions
- `error`: exceptions and failures

Notes:
- Extra ad-hoc gating for debug logs has been removed; rely on LOG_LEVEL to tune verbosity.
- Session tracker logs thread creation attempts and permission diagnostics: CreatePublicThreads, CreatePrivateThreads, SendMessagesInThreads. Success logs include the thread URL.

## Environment variables

- `NODE_ENV`: production → JSON logs; non-production → pretty
- `LOG_LEVEL`: overrides default; default is `info` in prod, `debug` otherwise
- `APP_NAME`: included in base fields

## Adoption

- Replaced console.* across Arbiter in:
  - Command handlers (event start/review, rank sync, name change flows)
  - Services (sessionTracker, channelCleanup)
  - Events (welcome, guildMemberUpdate)
- Nexus can adopt by importing from `@workspace/logger`.

## Examples

```ts
import { forInteraction } from '@workspace/logger';
const log = forInteraction(interaction).child({ mod: 'eventReview' });
log.debug({ page }, 'DB name lookup');
```
