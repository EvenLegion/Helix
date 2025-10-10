# Development mode flags

When testing locally or in servers where the bot lacks Manage Nicknames permission, you can allow nickname workflows to proceed without failing.

Set one of these env vars to enable the bypass:

- DEV_ALLOW_NICK_EDIT=1
- ALLOW_NICK_DEV_APPROVE=1

What it does:
- In name change approvals, if Discord returns Missing Permissions (50013), the bot will approve the request and update the database, reply success, and archive the thread. It will not change the actual Discord nickname.
- In rank sync, the bot will compute the decorated nickname and mark the DivisionMembership row as in_sync with a note that a dev bypass was used. The Discord nickname will not be changed.

Notes:
- Only Missing Permissions errors are bypassed. Other errors still surface.
- Remove the flag in production.
