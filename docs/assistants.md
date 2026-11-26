# AI assistants (26.11.2026)

Two assistants, one module (`src/assistant.js`), one model call path, transcripts in D1.

## 1. Customer page assistant (`/p/<key>`)

- **Master kill switch (26.11.2026, later the same day): the AI chatbot tab is in every portal; `PAGE_ASSISTANT=0` on the Worker (Cloudflare dashboard → Variables, `keep_vars` keeps it across deploys, no deploy needed) turns everything off at once: no tab, no widget, no chat answer, no settings, and the portal assistant's guide does not mention it, even if a store saved `page: true`. Earlier the same day it was the other way round (only `PAGE_ASSISTANT=1` turned it on). Local tests: `scripts/assistant-off-check.mjs` (`PAGE_ASSISTANT=0` in `.dev.vars`) and `scripts/assistant-check.mjs` (no flag).**
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

## AI chatbot tab in the portal (26.11.2026)

Visible in every portal unless `PAGE_ASSISTANT=0` (then the tab, its routes and the settings do not exist). Code: `public/portal/chatbot.js`, routes in `src/worker.js` (`/api/portal/assistant/settings`, `/api/portal/chatbot/*`).

- **Switch** at the top: on/off for all customer pages, applied at once, separate from Save (`{ onlyPage: true, page }`). **Off by default** for every store.
- **Rules** (what it may answer, what it must never say or do, tone, when to pass to the team, blocked words and phrases), **Knowledge** (9 boxes + contact), **Examples** (question + answer pairs, max 30), **Conversations** (every customer chat, "Needs you" filter, "Use as example" / "Teach the chatbot" on any chatbot answer, "Mark as handled"). Total text limit 24,000 characters.
- **Recommended rules** (`DEFAULT_ASSIST` in `src/assistant.js`) are filled in and active until the store saves its own (`customized: true`). They contain no facts about the store. After the first Save, what the store saved always wins, even when empty. "Reset to the recommended rules / examples" in the tab.
- **Priority in the prompt**: facts of the page, then knowledge, then the store's rules (binding), then examples. An example wins over knowledge when they disagree (it is the newest instruction). Blocked phrases are checked after the model: a hit replaces the answer with the hand-off message and the question goes to the team. Prices are checked as before.
- **Try it** (right side of the tab, below on narrow screens): answers with the rules exactly as written in the form, even unsaved, for a sample customer (Alex) or a real lead. Nothing is saved on a lead, no notification, no count (`chats t_<session>`, 30 per 10 min). It shows why an answer was blocked and offers "Save as example".
- **Unsaved changes**: leaving the tab, Sign out, Exit view, closing or reloading the page asks first. Switching between Rules, Knowledge and Examples keeps the draft.
- Checks: `scripts/assistant-check.mjs` (72, real Workers AI, no flag) and `scripts/assistant-off-check.mjs` (13, `PAGE_ASSISTANT=0`).
