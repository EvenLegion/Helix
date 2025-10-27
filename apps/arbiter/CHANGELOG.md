# Arbiter Changelog

All notable changes to the Arbiter app will be documented in this file.

## Unreleased

- Event tracking UX and resilience
  - Added session-centric closing path: `/event stop` now accepts a `session` option with autocomplete to select an open session.
  - “Close Event” button flow no longer depends on the main voice channel existing; it now resolves the root session and proceeds even if the VC was deleted.
  - Notifications and inactivity messages now include cached channel names when channels are deleted and direct moderators to use session-based closing.
  - Interaction handling hardened: subcommands like `start` and `add-vc` now defer immediately and respond via `editReply` to avoid “Unknown interaction” 3s timeouts.
  - Session tracker treats Unknown Channel (10003) as deletion and caches channel names to improve message clarity after deletions.
