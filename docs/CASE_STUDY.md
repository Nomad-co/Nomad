# Nomad case study draft

## Problem

ChatGPT and Claude keep separate memories. Users either repeat context, paste long conversations, or accept inconsistent answers.

## Product

Nomad is a user-controlled MCP passport for facts, uploaded documents, and explicit conversation handoffs. Every read is labeled in an audit log. Sealed fields are excluded from assistant retrieval. Existing facts use reviewable proposals unless the user trusts a client for explicit automatic updates.

## Evidence so far

- Both hosted assistants completed authenticated reads with correct audit labels.
- Sealed marker searches returned no results in both assistants.
- A two-client collision applied one proposal and superseded the other without losing an update.
- ChatGPT invoked Nomad in 0/5 natural prompts and 4/5 direct prompts. This led to an explicit one-line connector primer in setup guidance instead of claiming automatic invocation is reliable.
- Local tests validate a 31-page PDF path, one-time extraction, 0/20 misses on controlled keyword queries, and exact preservation for ten synthetic verbatim handoffs.

## Limits

The hosted model chooses whether to call Nomad. Nomad does not synchronize vendor memory or silently capture chats. Revocation stops future reads but cannot retract context already sent. Real-document recall, onboarding time, device installation, seven-day safety, and the full cross-client scenario comparison still require field evidence.

## Next evidence

Run the small hosted prompt budget in `M3_M8_VALIDATION.md`, complete device and onboarding trials, then operate the pilot for seven consecutive days before making reliability claims.
