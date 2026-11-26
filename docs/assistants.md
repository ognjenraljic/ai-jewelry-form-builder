# AI assistants (26.11.2026)

Two assistants, one module (`src/assistant.js`), one model call path, transcripts in D1.

## 1. Customer page assistant (`/p/<key>`)

- **Off by default for every store.** The store turns it on in Portal → Bookings → Assistant on customer pages (`clients.data.assistant.page`). Off = no widget, no script, the API answers `{ on: false }` without calling the model.
- **Knows**: everything the page shows (`pageFacts()` in `src/leadpage.js`: design choices, budget, Option 1 / Option 2 with exact prices, price hold, deposit and booking state, open times, appointments, next step after deposit, store info) plus the store's own knowledge (9 text boxes, Q&A list, contact line). Questions the store should answer: `docs/assistant-store-questions.md`.
- **Guardrails**: only facts and knowledge; prices exactly as written (`pricesOk()` rejects any dollar amount that is not on the page, in the knowledge or in the customer's own messages, and shows a hand-off reply instead); no dates, discounts, financing or medical advice that are not written; replies in the customer's language; prompt injection ignored; 12 messages per 10 min and 50 per day per lead.
- **Hand-off**: `[team]` from the model (or a rejected answer) logs `chat_question` → Notifications ("asked the page assistant something only you can answer") and marks the chat on the lead card ("Assistant chat · N questions · needs you"). The store reads the whole chat from the lead card.
- **Actions**: `[deposit]` / `[book]` become buttons in the chat that click the page's own Deposit / Book buttons (same tracking, same GHL link, same calendar).
- **Preview**: the store's "Their page" (`?preview=1`) chats in a separate thread (`pv_<lead>`) and never notifies.
- Routes: `GET|POST /api/page/<key>/chat`. Front end: `public/page-chat.js` + `public/page-chat.css`, loaded only when on.

## 2. Portal assistant

- Floating "Ask" button on every portal tab (`public/portal/assistant.js`), works in admin view too (read only).
- **How-to**: answers from `PORTAL_GUIDE` (in `src/assistant.js`). When the portal changes, update the guide.
- **Numbers**: the server computes exact totals (`statsText()`): periods (today, this week, this month, last month, 7/30/90 days, year, all time), months, status and pipeline value, win rate, pieces, budgets, tags, cities from area codes, weekdays, busiest hours, forms, deposits, appointments, answer speed, AI usage, top open opportunities, 30 newest leads, and the questions customers passed from the page assistant. The model only reads them, it does not count.
- `[tab:x]` tags become "Open <Tab>" buttons. 25 messages per 10 min, 200 per day per portal session.
- Routes: `GET|POST /api/portal/assistant`, `GET|PUT /api/portal/assistant/settings`, `GET /api/portal/leads/<id>/chat`.

## Cloudflare

- **Workers AI** through the existing `AI` binding: no new keys, data stays in Cloudflare, cost is a fraction of a cent per answer. Model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (the same one that writes quote messages); `CHAT_MODEL` var on the Worker switches it without a deploy.
- **D1** table `chats` (migration `0041_chats.sql`): one row per lead (`p_<lead>`), per preview (`pv_<lead>`) and per portal session (`a_<session>`). History lives on the server, so a customer cannot inject fake assistant turns.
- Optional later: AI Gateway in front of the binding (logs, caching, rate limits, fallback model); Vectorize only if a store's knowledge grows far past what fits in the prompt.

## Checks

`BASE=http://127.0.0.1:8823 node scripts/assistant-check.mjs` (real Workers AI through local wrangler dev, a few cents): 34 checks, prints every question and answer.
