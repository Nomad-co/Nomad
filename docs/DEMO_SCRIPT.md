# Nomad two-minute demo script

1. **0:00–0:15 · The problem** — Show the limits page. Explain that assistant memories are separate and the model decides when to call connectors.
2. **0:15–0:35 · Passport** — Show normal and sealed fields, a connected ChatGPT client, and its trust setting.
3. **0:35–0:55 · Cross-assistant read** — Use one direct ChatGPT prompt to load a saved preference. Open the audit row with the ChatGPT label.
4. **0:55–1:15 · File retrieval** — Upload a PDF once. Ask one question whose answer is in a bounded chunk and open its citation URL.
5. **1:15–1:35 · Thread handoff** — Save a short ChatGPT summary, retrieve it in Claude, and point out the `model_summarized` warning.
6. **1:35–1:50 · Quiet consent** — Show one pending overwrite in the review digest, approve it, then show version history.
7. **1:50–2:00 · Evidence** — Show tool-call rate, median decision time, sealed leak count, and free-tier warnings.

Record the final video only after deployed client checks pass. Do not splice synthetic metrics into the recording.
