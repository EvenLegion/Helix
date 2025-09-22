# Event commands — How to use

This guide shows moderators and event hosts how to run and manage voice-based events with the `/event` commands.

## Overview
- Track participation in one or more voice/stage channels
- Group multiple channels into a single event review (sessions are grouped via a root session)
- Autocomplete merit type selection
- Clean up bot-created channels after the event ends (when they become empty)

## Permissions you need
- You must be able to invoke slash commands in the server.
- For creating extra voice channels with `/event add-vc` (without picking an existing one), the bot needs "Manage Channels".

## Commands

### 1) `/event start`
Start tracking participation for a voice or stage channel.

Options:
- `merit_type` (required): Choose what type of merit to award. Autocomplete lets you search by name/description/value.
- `channel` (optional): Pick a voice/stage channel to track. If omitted, run the command in the target voice channel or in a text channel in the same category.
- `description` (required): A short note for this event (5–255 chars). This is saved on the event, echoed in the start reply, shown in the review header (alongside merit type and value), and used as the Merit.description for recipients when you confirm awards on stop.

How to use:
1) Join the voice/stage channel (or open a text channel under the same category).
2) Run `/event start` and select the merit type.
3) Optionally select a specific channel if you aren’t in/near it.
4) Provide a meaningful description that will be saved onto the event and applied to awarded merits.

Notes:
- The bot prevents duplicate active sessions for the same channel.
- If not given a channel, the bot will resolve the channel based on where you run the command:
  - If run in a voice/stage channel → that channel is used.
  - If run in a text/thread channel → the bot looks for a voice/stage channel in the same category.

### 2) `/event add-vc`
Add or link another voice/stage channel to the current event. Use this when your event needs overflow rooms or multiple parallel rooms, but you still want a single review at the end.

Options:
- `channel` (optional): An existing voice/stage channel to attach.
- `name` (optional): If you don’t pick an existing channel, the bot can create a new one with this name under the same category as the main event channel.
  - If you omit both `channel` and `name`, the bot will auto-create a subchannel named `<root-name>-subN` (e.g., `Ops VC-sub1`, `Ops VC-sub2`). It picks the next available number among siblings, copies permissions from the main channel, and matches the channel type (voice or stage).

How to use:
1) Run this from the tracked channel (or a text channel in the same category) to auto-target the current event.
2) Either:
   - Provide an existing voice/stage `channel` to attach, or
   - Provide a `name` to create a new channel with copied permissions from the main event channel.

Notes:
- All added channels are grouped under one “root” event. A single review will cover everyone.
- When creating a new channel: the bot copies permission overwrites from the first (main) channel and matches channel type (voice vs stage).
- Auto-naming: When neither `channel` nor `name` is given, the created channel will be named `<root-name>-subN` in the same category (when possible). The name is kept within Discord’s channel name length limit.
- You can’t add a channel that’s already tracked by a different event.
- If the bot lacks "Manage Channels", creation will fail—attach an existing channel instead.

### 3) `/event stop`
Stop tracking for the current event and open the review UI.

Options:
- `channel` (optional): A voice/stage channel belonging to the event you want to stop. If omitted, run the command in/near a channel from the event.

What happens when you stop:
- All sessions in the event group (main + added channels) end together.
- Participants across all channels are merged into the root session for a single merit review.
- The review UI pages through participants and supports “previous/next”, “confirm”, and “cancel”.
- Default pre-selection: anyone present for ≥ 20% of the event duration is marked to receive merits (you can toggle per user).
- For any bot-created channels, a cleanup watcher starts—when a channel is empty after stop, the bot deletes it.

## Tips & troubleshooting
- “I don’t see the channel I want”: Use the `channel` option explicitly, or run the command from a text channel in the same category.
- “Bot failed to create a channel”: Make sure the bot role has "Manage Channels". You can still attach an existing channel via the `channel` option.
- “Multiple events at once”: If more than one event is active in the guild, run `/event add-vc` from a channel that already belongs to the intended event so the bot picks the right group.
- “Names look odd in review”: The UI first uses stored DB names then overlays live guild display names for the current page. Some users may be missing from caches; that’s normal during the first page render.

## Quick examples

- Start an event in the current voice channel:
  - `/event start merit_type: Training`

- Start an event for a specific stage channel:
  - `/event start merit_type: Ceremony channel: #Stage 1`

- Add an overflow room by creating a new channel (copied permissions):
  - `/event add-vc name: Overflow Room`

- Attach an existing voice channel to your current event:
  - `/event add-vc channel: #Ops VC`

- Stop the event and open the review UI:
  - `/event stop` (use `channel:` if you’re not in/near the event’s channels)

---
If you have questions or run into issues, contact a moderator or an admin.
