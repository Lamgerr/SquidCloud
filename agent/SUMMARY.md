# What happened while you were away

## Done
- **secos is started and checked.** It wasn't running (log was a week old). The existing boot script launches it without a dex token, so it prompted and exited; I started it with the token from `~/dex/.env` instead. Process `30941` has been alive and the log ends with `[secos] connected: localhost` — stable, no new errors.
- No changes were made to the app repo for this request.

## In progress
- Nothing actively being edited.

## Blocked / needs a decision
- **`~/.termux/boot/start-secos` is broken**: it doesn't pass `DEX_TOKEN`, so secos will prompt for a token and exit on the next Termux boot. I deliberately did not patch it because it's a config file outside this repo. Say the word and I'll fix it.
- No local `tsc` here; Vercel's cloud build is the verification authority for the app.
- Vercel CLI first attempt can return "Not authorized"; an immediate retry has worked.

## Queued next
- Patch the secos boot script (on approval), or any further app UX tuning.
