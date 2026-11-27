# GHL workflows for District: what JewelryLead does and what to set up in GoHighLevel

*November 27, 2026. The three flows from our research (abandoned quote, appointments, pick up and review), plus the phone (Quo), SMS registration (A2P 10DLC), Google Calendar and Google Meet.*

## How it works

JewelryLead knows where every customer stands, so **JewelryLead decides when each message goes out**. At that moment it fills the JL fields on the GHL contact and adds an **event tag** (for example `jl offer 24h left`). Every workflow in GHL looks the same: it starts on that tag, sends a text or an email, and removes the tag at the end. GHL needs no waits, no dates and no quote logic.

- The tag is removed first and then added, so the workflow runs again when the same customer gets the same tag a second time (for example a second appointment).
- The same event is never sent twice. The portal shows the last 40 events (Forms → GoHighLevel → Automations).
- Quote and review messages go out only during the day, by the customer's own clock (10 am to 7 pm; the last reminders 9 am to 9 pm). The customer's browser sends their time zone when they click or book, and it is saved on the contact. Appointment reminders go out exactly on time.
- Quote follow-ups stop on their own after a deposit, a booking, Won or Lost, or archiving.
- **Control group:** 10% of leads get no quote follow-ups (switch in the portal). This is the only way to know whether the messages actually bring in deposits.
- Turning it on counts from that moment: older leads do not get messages they "missed".

## What is built in JewelryLead

| Part | What it does |
|---|---|
| Automations (portal, Forms → GoHighLevel) | "Create the JL fields" button: creates 15 contact fields. Three groups (quote / appointments / review), control group, days until the review request, main switch, list of the last tags sent with any errors. |
| Contact fields | `jl_lead_id`, `jl_piece`, `jl_page_url` (link without `?preview=1`, so visits are counted), `jl_render_url`, `jl_price`, `jl_option_2_price`, `jl_offer_expires`, `jl_appt_type`, `jl_appt_time`, `jl_appt_location` (store address / Meet link / "calls you at"), `jl_meet_link`, `jl_reschedule_url`, `jl_order_no`, `jl_order_status`, `jl_occasion_date` |
| Order | "Mark picked up" on the last stage, "Gift or surprise" with the occasion date, "Remake or fix open" (holds the review request) |
| Appointments | Done / No-show in the portal also updates the GHL calendar (Showed / No-show). An appointment moved, cancelled or marked in GHL comes back to JewelryLead (checked every 15 minutes), so reminders go out for the new time. The studio event in GHL has the store address. Phone calls have the customer's number. |
| Google Meet | Bookings → "Google Meet link for each video call". GHL creates a unique Meet link per appointment. The customer sees it on their page, in the calendar file and in the `jl_meet_link` field. |
| Store notifications (also without GHL) | Deposit opened but not paid after 20 minutes, refreshed price unlocked or a new price is needed, appointment ended but not marked. The refreshed-price decision now runs in the background, not only when the customer opens the page. |
| Customer page | Honest expiry wording: "After that we re-quote at that day's metal price, which can go up or down". |
| SMS consent | The optional SMS checkbox for the request now also covers "order updates and a follow-up about my experience". Tags `sms consent` / `sms marketing consent` go on the contact. New tag `jl deposit paid` when a deposit comes in. |

## Tags (workflow triggers)

| Tag | When | Message type |
|---|---|---|
| `jl deposit click` | clicked the deposit, did not pay within 20 min | sales |
| `jl offer not opened` | 4 h after the quote, has not opened the page | reply to their request |
| `jl offer saved` | 4 h after the quote, opened it, clicked nothing | sales |
| `jl offer 24h left` | 24 h before the price hold ends | sales |
| `jl offer final hours` | 6 h before the end | sales |
| `jl offer expired` | price hold ended | sales |
| `jl offer closeout` | 6 days after expiry, no refreshed quote asked | sales |
| `jl refresh ready` | refreshed price unlocked (metal steady), held 24 h | sales |
| `jl refresh needs quote` | metal moved: Enrique sends a new price | internal |
| `jl appt booked` | booked (also when the appointment is moved) | informational |
| `jl visit 3 days` | studio visit in 3 days (if booked more than 3.5 days ahead) | informational |
| `jl visit 24h` | studio visit tomorrow | informational |
| `jl visit 2h` | studio visit in 2 h | informational |
| `jl call 1h` | online consultation in 1 h | informational |
| `jl call 10 min` | online consultation in 10 min | informational |
| `jl appt no show` | marked No-show | informational |
| `jl appt showed no deposit` | marked Done, still no deposit 2 h later | sales |
| `jl appt cancelled` | cancelled (not moved) | informational |
| `jl order ready` | order moved to "Ready for pick up" | informational |
| `jl picked up` | marked "Picked up" | informational |
| `jl review request` | day after pick up (grillz 3 days, gifts 2 days after the occasion) | review request |

**SMS rule:** informational messages and the review request go by text only to contacts with the `sms consent` tag. Sales messages go by text only with `sms marketing consent`. Everyone else gets an email (with an unsubscribe link). `jl offer not opened` may use `sms consent` (it is the quote the customer asked for).

---

## What to do in GHL, step by step

### 1. Token (Private Integration)
Settings → Private Integrations → JewelryLead token → Edit scopes. Add these to the existing ones:
- **View Custom Fields** and **Edit Custom Fields** (for the JL fields button)
- **Edit Contacts** (fields and tags; probably already on)
- **View Calendars**, **View Calendar Events**, **Edit Calendar Events** (Done/No-show, moved appointments, Meet link)

If the key changes after adding scopes, paste the new key into the portal (Forms → GoHighLevel).

### 2. Phone and SMS: Quo + GHL (recommended)
Quo (formerly OpenPhone) has an **official HighLevel app**: GHL contacts sync to Quo, and every Quo call (recording, AI summary) and text is logged in the contact's conversation in GHL. **GHL workflows cannot send texts from a Quo number.**

So:
- **Enrique keeps his Quo number** for his own calls and 1:1 texts. Connect Quo → HighLevel so everything shows on the contact.
- **GHL gets its own number (LC Phone)** only for automated messages (reminders, reviews, quote follow-ups). Every message says "Enrique from District", so customers know who is writing. Enrique answers replies from GHL (Conversations or the LeadConnector app).

**Quo → HighLevel:**
1. Quo **Business or Scale** plan. The integration is not available on Starter.
2. In Quo (Owner or Admin): Settings → Integrations → HighLevel → Connect.
3. Sign in to GHL, pick the District sub-account, pick which Quo numbers sync.
4. The GHL login must be allowed to install Marketplace apps (agency or admin).

Notes: Quo does not merge existing contacts by phone number, so duplicates are possible. Activity during a disconnection is not synced afterwards. Contacts created in Quo do not go to GHL (not important: ours go from JewelryLead into GHL).

**Alternatives (not recommended now):**
- Port the Quo number into GHL: one number for everything, but Enrique loses Quo. Takes 2-4 weeks and needs an LOA and a recent bill.
- GHL webhook → Quo API: texts from the Quo number, but GHL does not know about STOP replies in Quo (compliance risk). Not officially supported.

### 3. A2P 10DLC registration of the GHL number (no SMS without it)
Buy a number: Settings → Phone System → Phone Numbers → Add Number (720 or 303, Denver). Then Settings → Phone System → **Trust Center → A2P Messaging → Start Registration**.

**Brand:**
- "Has a Tax ID?" → **Yes** (Standard brand). Sole proprietor is only for businesses without an EIN.
- Legal business name **exactly as on the IRS CP-575 or 147C letter**. Uploading the CP-575 fills in name, EIN and address. An EIN issued in the last 15 days may be rejected.
- Business type, industry, EIN, business email. Address without a P.O. box.
- Authorized representative (Enrique): name, business email, phone, title. Then identity verification (Persona or an email code).

**Campaign:**
- Trust Center → Brand & Campaigns → Campaigns → Create Campaign → **Low Volume**, **Manual Setup** (the form is ours, not the GHL chat widget).
- Use case: **Mixed** (reminders and offers from the same number). GHL turns this into Low Volume Mixed ($1.50 per month).
- Description (example): "District Jewelers sends appointment confirmations and reminders, order updates, review requests and follow-ups about custom jewelry quotes to customers who requested a quote on our website form and opted in to text messages."
- Opt-in: web form. Form URL: District's page with the JewelryLead form. Flow description: "Customers fill out the custom jewelry request form on district-jewelers.com. Two separate, optional, unchecked checkboxes: one for non-marketing texts about their request, quote, appointments and order, one for marketing texts. The form can be submitted without either."
- Privacy and Terms: the store has no own pages, so use ours (the form already links them): `https://jewelrylead.com/legal/<form id>/privacy` and `.../terms`. They already include the no-sharing sentence for mobile data, HELP/STOP and "Carriers are not liable".
- Sample messages (two, different):
  > District Jewelers: Hi Ana, you're booked for a studio visit Sat, Nov 29 at 2:30 PM, 1550 Larimer St. Need another time? jewelrylead.com/p/... Reply STOP to opt out.

  > District Jewelers: Hi Ana, Enrique here. Your custom grillz price is held until Sun 3 PM. Want a quick 10-min call to go over it? jewelrylead.com/p/... Reply STOP to opt out.
- Pass the AI check → Submit. Approval takes a few business days. Then check that the number shows "A2P Verified".

**Costs (GHL, Nov 2026):** brand + first campaign $22.50 once, Low Volume Mixed $1.50 per month, number $1.15 per month, SMS about $0.0075 per segment plus carrier fees.

**Common rejection reasons:** checkbox required or pre-checked; frequency, "message and data rates" or STOP missing next to the checkbox; marketing and non-marketing in one checkbox; privacy policy without the no-sharing sentence; short links (bit.ly); business name on the website different from the brand name (then add "We are doing DBA as District Jewelers" to the description). Our form covers all of these except the last, which depends on the legal business name.

**Important for the release:** the SMS consent on the form (commit b084e4d) is part of this branch. Without it contacts have no `sms consent` tag, so the SMS workflows have nobody to text (only emails go out).

### 4. Google Calendar and Google Meet
For each team member who takes appointments (Enrique):
1. In GHL (logged in as him): **Calendars → Calendar Settings → Connections → + Add New → Google → Connect**, allow full calendar access.
2. On the same screen (Calendar Configuration): **Linked Calendar** = his Google calendar (GHL writes appointments there). **Conflict Calendars** = all of his calendars that block his time. Only events marked "Busy" block slots.
3. Keep **one-way sync** (the default): GHL appointments go to Google, and Google busy times block slots. Two-way sync would turn every Google event into a GHL contact and trigger workflows.

**Online consultation** calendar:

4. Calendars → Online consultation → Edit → **Team members**: Enrique is a member.
5. On his row: **+ Add Location → Google Meet → Save**. This works on Round Robin and Service calendars, not on Event calendars.
6. In the JewelryLead portal: Bookings → Calendar on customer pages → turn on **Google Meet link for each video call** → Save.

Both calendars (Online consultation and Studio visit):

7. **Notifications:** turn off the built-in **Reminder**, **Cancellation** and **Reschedule** notifications, because our workflows send these now (otherwise customers get everything twice, and GHL's "Cancellation" even goes out when an appointment is marked No-show). Turn off the booked confirmation too (the `jl appt booked` workflow sends it).
8. "Allow Google Calendar to send invitation emails to attendees": **turn on** if you want the customer to also get a Google invite with the Meet link (nice for video calls). If it stays off, the customer gets the link from our message and on their page.

**Test (required, because GHL does not document that an API appointment creates a Meet link):** book yourself a video consultation from a customer page. In the portal Bookings tab the appointment should have a Meet link, and the customer page should show a Meet button. If there is no link after a few minutes: the Google connection expired, the location is not Meet, or the appointment is not assigned to Enrique. The customer then sees "Video link coming by text and email".

### 5. Reputation (for the review request)
1. Reputation → Settings: connect the **Google Business Profile** of the right location.
2. Review Requests: turn on SMS and email, enter the text (below), **reminders: 2 times, 3-4 days apart** (they stop on their own when the link is clicked).
3. **Do not build** a "how did we do?" step that sends only 4-5 star customers to Google (review gating: forbidden by Google and the FTC). Everyone gets the same public link.
4. No gift or discount for a review. Never ask for Yelp reviews.

### 6. Workflows (one per tag)
**For every workflow:**
- Trigger **Contact Tag** → Tag Added → the tag from the table.
- Settings: **Allow re-entry: ON**, **Stop on response: OFF**. No time window needed (JewelryLead already picks the time).
- Message: **If/Else** "Contact has tag `sms consent`" (sales messages: `sms marketing consent`) → **Send SMS**, otherwise → **Send Email**.
- Last step: **Remove Contact Tag** (the same tag).
- In the text use the fields from **Custom Values → Contact → JL ...** (the list with exact keys is in the portal: Forms → GoHighLevel → "Fields to use in your messages").

Message texts (from Enrique, always with the store name and STOP in the first message):

**Quote**
- `jl offer not opened`: "Hey {{contact.first_name}}, Enrique from District. Did you get a chance to see your {{contact.jl_piece}} design? It's here: {{contact.jl_page_url}} Reply STOP to opt out."
- `jl offer saved`: "Hey {{contact.first_name}}, your {{contact.jl_piece}} design is saved here: {{contact.jl_page_url}} Price held until {{contact.jl_offer_expires}}. Questions? Just reply. Reply STOP to opt out."
- `jl offer 24h left` (text + email with the render `{{contact.jl_render_url}}`): "{{contact.first_name}}, Enrique here. Your {{contact.jl_piece}} is on hold until {{contact.jl_offer_expires}}. Want me to walk you through it on a quick 10-min call? {{contact.jl_page_url}}"
- `jl offer final hours`: "Last few hours on your {{contact.jl_piece}} price. After that I re-quote at that day's gold price, which can go up or down. {{contact.jl_page_url}}"
- `jl offer expired`: "Your price hold ended. Want today's price? Tap 'Request a refreshed quote' on your page: {{contact.jl_page_url}}"
- `jl offer closeout`: "Should I keep your {{contact.jl_piece}} design on file, or close it out for now? Either is totally fine."
- `jl refresh ready`: "Your refreshed price is ready and held for 24 hours: {{contact.jl_page_url}}"
- `jl deposit click`: **Create Task** for Enrique "Call/text {{contact.first_name}}: opened the deposit, didn't pay" + Internal Notification → Wait 2 h → If/Else tag `jl deposit paid` → end, otherwise text (marketing consent): "Anything I can help with on the deposit? I can hold it with a smaller one or set up a quick call."
- `jl refresh needs quote`: only **Internal Notification + Task** for Enrique: "Metal moved: send {{contact.first_name}} a new price ({{contact.jl_lead_id}})".

**Appointments**
- `jl appt booked`: "Hey {{contact.first_name}}, it's Enrique from District. You're booked: {{contact.jl_appt_type}}, {{contact.jl_appt_time}}. {{contact.jl_appt_location}}. Need another time? {{contact.jl_reschedule_url}} Reply STOP to opt out." The email can also include the Google Meet link `{{contact.jl_meet_link}}`.
- `jl visit 3 days`: "See you {{contact.jl_appt_time}} at the studio, {{contact.first_name}}. Need another time? {{contact.jl_reschedule_url}}"
- `jl visit 24h`: "See you tomorrow, {{contact.jl_appt_time}}. Reply C to confirm or R to pick another time." Optional: Wait for reply 21 h → no reply → Task "Call {{contact.first_name}}, visit not confirmed".
- `jl visit 2h`: "Enrique is pulling pieces for you. {{contact.jl_appt_location}}. See you at {{contact.jl_appt_time}}."
- `jl call 1h`: "Your consultation with District is in 1 hour ({{contact.jl_appt_time}}). {{contact.jl_appt_location}}"
- `jl call 10 min`: "Calling you in 10 minutes. {{contact.jl_meet_link}}" (for phone calls: "Calling you in 10 minutes, save this number so you pick up.")
- `jl appt no show`: "We missed you today, no worries. Want to pick another time? {{contact.jl_reschedule_url}}" → Wait 1 day → link once more → Wait 2 days → last time.
- `jl appt showed no deposit` (marketing consent for text): "Great meeting you, {{contact.first_name}}. Here's your {{contact.jl_piece}} with the price: {{contact.jl_page_url}} I'm holding it for you."
- `jl appt cancelled`: "Got it, want to pick another time? {{contact.jl_reschedule_url}}"

**Pick up and review**
- `jl order ready`: "Your {{contact.jl_piece}} is ready for pick up! Order {{contact.jl_order_no}}. Reply to set a time."
- `jl picked up`: no review link. Just a "Thank you" from Enrique (or a Task for Enrique to send the reveal clip). Optional +10 days, marketing consent only: "Tag @district in a pic with your piece, we'd love to repost it."
- `jl review request`: If/Else tag `review requested` → end. Otherwise **Send Review Request** (text or email by consent) + Add tag `review requested`. Text in Reputation Settings: "Hey {{contact.first_name}}, Enrique from District. Hope you're loving the {{contact.jl_piece}}! If you have a minute, an honest Google review helps us a lot: {review_link}. Reply STOP to opt out."
- Separate workflow **Review Received** 1-2 stars → text and email to the owner + Task "call the customer within 24 h".

### 7. Turn on and test
1. Portal → Forms → GoHighLevel: **Create the JL fields in GoHighLevel** (should show "15 of 15 fields ready").
2. Build and **publish** all the workflows from step 6.
3. Test contact (your own email and phone, with the SMS checkboxes ticked): submit the form, then in the portal Automations turn on **Send automation tags to GoHighLevel**. The first tag arrives after 4 h (`jl offer not opened` or `saved`). Appointments are faster to test: book a studio visit and a call for yourself, and `jl appt booked` should arrive with the time and the address or Meet link.
4. In the portal, "Last automation tags" shows what was sent and any errors. In GHL: Contact → Activity and Workflow → Execution logs.
5. **Do not turn anything on** until A2P is "Verified": until then the SMS step fails, while email works.

## Open / to verify live
- Whether an API appointment creates a Meet link (GHL does not document it; we expect yes, test in step 4).
- Whether a tag added through the API fires "Contact Tag Added" (practice says yes, test in step 7).
- District's legal business name and EIN for A2P (question for Enrique), and whether Quo is already registered (it changes nothing for Quo calls).
- Email reminders for stores without GHL (Resend) are not built; this works only through GHL.
