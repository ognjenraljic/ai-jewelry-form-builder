# Offer timeline on customer pages (27.11.2026)

Ognjen's sketch for District, logic in `src/offer.js` (pure functions), page in `src/leadpage.js`, live clock in `public/lead-page.js`.

1. The offer is held for `offerHours` (48 h) from the latest quote message or from turning on Option 2.
1a. When the price is far over the budget (above the budget top × `offer.far`, 1.5) and the jeweler did not show Option 2, the page shows a blurred "We might have something cooking for you" card with a countdown, and reveals the option closer to the budget after `offer.reveal` hours (8). It uses the jeweler's Fits the budget choices when they exist, otherwise `middleGround()` from the price list. `offer.autoreveal` 0 turns this off.
2. Less than 24 h left: yellow. 3. Less than 12 h left: red. 4. Last hour: red with pulse. Shorter offers scale the thresholds (half, quarter, eighth of the offer).
5. Expired: the options are blurred and locked (no deposit button, also in the bottom dock and the visit card); "Request a refreshed quote" plus Book an appointment. `POST /api/page/<key>/refresh` (only after expiry) stores `quotes.refresh = { at, spot, status: 'pending' }` and logs `refresh_requested` (Notifications, group Bookings & deposits).
6. After `offer.refreshwait` hours (12) the first page view decides once: gold moved more than `offer.metalmove` % (3) = `moved` (the store sends a new price), otherwise `ready`: a new offer held for `offer.refreshhours` (24), prices at today's metal minus `offer.discount` % (0). A new quote message from the jeweler cancels an old request.

Settings: Portal → Pricing → Quote & alerts → Offer timeline on customer pages.
Local preview of every stage (DEV_MODE only): `/p/<key>?preview=1&sim_elapsed=<hours since the offer>`, plus `sim_refresh=pending|ready|moved` and `sim_discount=<%>`.
Checks: `scripts/offer-stages-check.mjs`. Not built yet: reminder texts or emails to the customer at 24 h, 12 h and 60 min (needs the SMS consent release and GHL, or email).
