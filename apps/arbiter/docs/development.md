# Development utilities — commands and notes

These commands help with testing, data seeding, and content previews. They are intended for maintainers and may be restricted to dev environments.

## /import-users
Updates the user database from the guild members.
- Fetches members (filtered by a configured role in the command file) and upserts into the `User` table.
- Fields saved: id, username, nickname; placeholder values for email/name are used where necessary.
- Run in a server where the bot has permissions to fetch members.

Source: `apps/arbiter/src/app/commands/development/updateUserDB.ts`

## /get-users
Exports selected members with roles to a CSV.
- Filters members by a specified role, and selects a subset of roles to include in the CSV.
- Produces a temporary file and returns it as an attachment.

Source: `apps/arbiter/src/app/commands/development/getUsers.ts`

## /welcome-test
Sends a test welcome embed to a designated channel.
- Channel ID is configured directly in the command file.
- Useful for previewing the welcome message layout.

Source: `apps/arbiter/src/app/commands/development/welcomeEmbed.ts`

Notes:
- These utilities may assume specific role IDs and channel IDs configured in the code; adjust them before use in production.
- For any changes to text or logic, edit the corresponding file under `apps/arbiter/src/app/commands/development/`.

## Windows/OneDrive build note — Nexus prebuild cleanup

We added a prebuild step to the Nexus app that removes the `.next` folder before each production build:

- Location: `apps/nexus/package.json`
- Script: `"prebuild": "rimraf .next"`

Why this exists:
- On some Windows machines where the repo lives under OneDrive, Next.js occasionally fails with an `EINVAL: invalid argument, readlink` error against `.next/server/chunks`. This is due to OneDrive’s file virtualization and how symlinks/junctions are handled under the `.next` build output.
- Deleting `.next` prior to each build avoids stale or partially synced artifacts that can trigger the error.

Impact:
- Clean builds on Windows/OneDrive without manual intervention.
- Negligible overhead; the folder is recreated on each build anyway.

Alternatives or additional mitigations:
- Keep the repo outside of OneDrive-backed paths.
- Manually delete `.next` when the error occurs (the script automates this).
- Use a separate working directory for builds (e.g., local temp directory) if desired.
