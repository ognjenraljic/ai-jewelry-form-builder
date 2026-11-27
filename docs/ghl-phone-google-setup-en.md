# District Jewelers: connecting Gmail, Google Calendar, Quo and a GoHighLevel phone number

*November 27, 2026. Everything is done inside District's GoHighLevel sub-account, logged in as Enrique's own user (not at agency level), unless a step says otherwise.*

## Before you start

- Use **one Google account that belongs to the store** for Gmail, Calendar and Google Meet, not a personal account. Customer emails and appointments then stay with the business.
- **Google Workspace is not required.** HighLevel's Gmail sync works with a regular free @gmail.com account as well as a Workspace account, and so do Google Calendar and Google Meet. Free Meet only limits group calls of 3+ people to 60 minutes; a 10-minute consultation is not affected.
- Workspace (about $7 to $14 per user per month) is worth it if you want email on the store's own domain (for example `enrique@districtjewelers.com`), which looks more professional and lands in spam less often. If the store already has domain email through Google, that is Workspace: use it. Otherwise you can start with Gmail and reconnect later.

---

## Part 1. Gmail (customer emails inside GoHighLevel)

1. In GoHighLevel: **Settings → My Profile → Email (2-way Sync)**.
2. Choose **Gmail → Connect**.
3. Sign in with the store's Google account and allow everything Google asks for.
4. Done when it shows as connected.

**What you get:** emails with customers appear in **Conversations** on the contact, and replies from GoHighLevel go out from that Gmail address.

**Good to know:**
- Only emails with people who are already contacts sync. JewelryLead leads are contacts, because JewelryLead sends every lead to GoHighLevel.
- Anyone with access to Conversations in the sub-account can read these emails.
- Google allows about 500 emails per day from Gmail. This only applies to 1:1 emails; workflow emails go through GoHighLevel's own email service.

## Part 2. Google Calendar

1. In GoHighLevel: **Calendars → Calendar Settings → Connections → + Add New → Google → Connect**.
2. Sign in with the same Google account and allow **full calendar access**.
3. On the same screen (Calendar Configuration):
   - **Linked Calendar** = that Google calendar. GoHighLevel writes appointments there.
   - **Conflict Calendars** = every calendar that blocks Enrique's time. Only events marked "Busy" block slots.
4. Keep **one-way sync** (the default): GoHighLevel appointments go to Google, and Google busy times block slots. Two-way sync would turn every private Google event into a GoHighLevel contact and trigger workflows.

## Part 3. Google Meet (online consultations)

1. **Calendars → Online consultation → Edit → Team members**: Enrique must be a member.
2. On his row: **+ Add Location → Google Meet → Save**. This works on Round Robin and Service calendars, not on Event calendars.
3. After release, the JewelryLead team turns on **Bookings → "Google Meet link for each video call"** in the portal. Every video appointment then gets its own Meet link, shown on the customer's page and in the messages.

## Part 4. Calendar notifications (required)

On **both** calendars (Online consultation and Studio visit), in **Notifications**, turn off:
- Booked confirmation
- Reminder
- Cancellation
- Reschedule

Our workflows send these messages now. Otherwise customers get everything twice, and GoHighLevel's "Cancellation" even goes out when an appointment is marked No-show.

Optional: turn on **"Allow Google Calendar to send invitation emails to attendees"** if you want customers to also get a Google invite with the Meet link.

## Part 5. Test

Book yourself a video consultation from a customer page. The appointment should appear in Google Calendar and in the GoHighLevel calendar with a Meet link. If there is no link: the Google connection expired, the location is not Google Meet, or the appointment is not assigned to Enrique.

---

## Part 6. Quo (formerly OpenPhone)

### Which app is the real Quo?

In the GoHighLevel App Marketplace, search "quo". Two apps show up:

| App | Who makes it | Price | What it is |
|---|---|---|---|
| **Quo** (yellow "QUO" logo, about 1.2K installs) | **By Quo** | Free app (needs a Quo Business or Scale plan) | **The official integration. Install this one.** |
| Quo (OpenPhone) Connector | By Smart CRM Plugins | Paid | A third-party app (about 13 installs) that advertises two-way texting from OpenPhone numbers. Not made by Quo, and we have not verified what it does or whether it works with workflows. Do not install it. |

### How to connect

1. Quo must be on the **Business or Scale** plan. The integration is not available on Starter.
2. In the Quo app, as the workspace **Owner or Admin**: **Settings → Integrations → HighLevel → Connect** (or install "Quo by Quo" from the GoHighLevel Marketplace).
3. Sign in to GoHighLevel and choose District's sub-account. The GoHighLevel user must be allowed to install Marketplace apps. If Enrique's user is not, the agency owner does this step.
4. Choose which Quo numbers to sync (Enrique's main number).

### What the connection does

- **Calls on the contact:** every incoming and outgoing Quo call is logged in that customer's conversation in GoHighLevel, with the recording and Quo's AI summary and next steps.
- **Texts on the contact:** every text Enrique sends or receives on his Quo number shows in the same conversation.
- **Contacts in Quo:** every new GoHighLevel contact (including every JewelryLead lead) appears in Quo with a name, so Enrique sees who is calling.
- **Edits go back:** if Enrique corrects a name, phone or email in Quo, it is updated in GoHighLevel.

In short, GoHighLevel shows everything about a customer in one place: the lead, the design, the quote, appointments, and what Enrique said and texted.

### What it does not do

- **GoHighLevel workflows cannot send automated texts from the Quo number.** Automated reminders, review requests and quote follow-ups need a separate GoHighLevel number (Part 7).
- Contacts created in Quo do not go to GoHighLevel (not important: ours go from JewelryLead into GoHighLevel).
- Quo does not merge existing contacts by phone number, so a duplicate can appear.
- Activity during a disconnection is not synced afterwards.
- Activity is logged on the contact, not on the opportunity.
- It is not documented that a Quo text can trigger a GoHighLevel workflow, so a customer's reply in Quo cannot stop automated messages.

---

## Part 7. Buying a phone number in GoHighLevel

### What it is for

A GoHighLevel number (LC Phone) is the number GoHighLevel workflows text from: appointment reminders, review requests and quote follow-ups. Enrique keeps his Quo number for his own calls and texts. Customers get automated messages from the GoHighLevel number (every message says "Enrique from District") and personal calls and texts from Quo. Both show on the same contact. Replies to the GoHighLevel number arrive in GoHighLevel Conversations and the LeadConnector mobile app.

### How to buy it

1. In District's sub-account: **Settings → Phone System → Phone Numbers → Add Number**.
2. Choose **Local** and search area code **720** or **303** (Denver). Toll-free is possible, but a local number suits a local store better.
3. Pick a number and confirm.

**Cost (GoHighLevel, November 2026):** about $1.15 per month for a local number; texts about $0.0075 per segment plus carrier fees; calls per minute. It is charged to the agency or sub-account wallet, so the wallet needs a balance.

**After buying:** calls work right away. **Texts to US numbers do not go out until A2P 10DLC registration is approved** (Part 9).

**Watch out:** District's sub-account sits under an agency that is on a trial. If the trial does not allow buying numbers or needs a card in the wallet, the agency owner has to sort it out. If the trial ends, the number and registration can be lost, so make sure the agency is on a paid plan before starting A2P registration.

---

## Part 8. Porting the Quo number into GoHighLevel (alternative)

Instead of a second number, the Quo number can be moved (ported) into GoHighLevel, so one number does everything.

- **Pros:** one number and one inbox; every automation works natively.
- **Cons:** the number leaves Quo, so Enrique stops using the Quo app and uses the LeadConnector app instead. A2P registration is still needed in GoHighLevel.
- **How long:** usually **2 to 4 weeks**, and the date is not guaranteed.
- **What is needed:** a US in-app port request from an agency owner or admin (with the Labs feature turned on), a signed Letter of Authorization (LOA), and a phone bill from Quo not older than 90 days. You also need the Quo account details and port-out PIN from Quo.
- During the port, keep the Quo account active until GoHighLevel confirms the number has moved.

**Our recommendation:** keep Quo, connect it (Part 6) and buy a separate GoHighLevel number (Part 7). It works today, without a 2 to 4 week wait, and Enrique keeps the app he already uses.

---

## Part 9. A2P 10DLC registration (required before any texts)

US carriers block business texts from local numbers that are not registered. Registration is done once per sub-account.

### Brand
1. **Settings → Phone System → Trust Center → A2P Messaging → Start Registration**.
2. "Has a Tax ID?" → **Yes** (Standard brand). Sole proprietor is only for businesses without an EIN.
3. Legal business name **exactly as on the IRS letter (CP-575 or 147C)**. Uploading the CP-575 fills in name, EIN and address. An EIN issued in the last 15 days may be rejected.
4. Business type, industry, EIN, business email, address (no P.O. box).
5. Authorized representative (Enrique): name, business email, phone, job title. Then identity verification (Persona or an email code).

### Campaign
1. **Trust Center → Brand & Campaigns → Campaigns → Create Campaign → Low Volume → Manual Setup** (our form is not the GoHighLevel chat widget).
2. Use case: **Mixed** (reminders and offers from the same number). GoHighLevel turns this into Low Volume Mixed.
3. Description (example): "District Jewelers sends appointment confirmations and reminders, order updates, review requests and follow-ups about custom jewelry quotes to customers who requested a quote on our website form and opted in to text messages."
4. Opt-in: web form. Form URL: District's page with the JewelryLead form. Flow: "Customers fill out the custom jewelry request form on district-jewelers.com. Two separate, optional, unchecked checkboxes: one for non-marketing texts about their request, quote, appointments and order, one for marketing texts. The form can be submitted without either."
5. Privacy Policy and Terms: the store's own pages if it has them, otherwise the pages the form already links: `https://jewelrylead.com/legal/<form id>/privacy` and `.../terms`. They include the no-sharing sentence for mobile data, HELP/STOP and "Carriers are not liable".
6. Two different sample messages, for example:
   > District Jewelers: Hi Ana, you're booked for a studio visit Sat, Nov 29 at 2:30 PM, 1550 Larimer St. Need another time? jewelrylead.com/p/... Reply STOP to opt out.

   > District Jewelers: Hi Ana, Enrique here. Your custom grillz price is held until Sun 3 PM. Want a quick 10-min call to go over it? jewelrylead.com/p/... Reply STOP to opt out.
7. Pass the AI compliance check, then Submit. Approval takes a few business days. Afterwards the number should show **"A2P Verified"**.

### Costs (GoHighLevel, November 2026)
- Brand + first campaign: $22.50 once
- Low Volume Mixed campaign: $1.50 per month
- Resubmissions: free

### Common rejection reasons
- SMS checkbox required or pre-checked
- Frequency, "message and data rates may apply" or STOP missing next to the checkbox
- Marketing and non-marketing consent in one checkbox
- Privacy policy without the "mobile information will not be shared with third parties" sentence
- Short links (bit.ly) in sample messages
- Business name on the website different from the brand name (then add "We are doing DBA as District Jewelers" to the description)

Our form already covers all of these except the last one, which depends on the legal business name.

### Note about Quo
The Quo number is registered separately through Quo (Quo handles that registration itself). Enrique already texts from Quo, so that is most likely done. It does not cover the GoHighLevel number.

---

## Sources
- Gmail 2-way sync: https://help.gohighlevel.com/support/solutions/articles/48001235216-connect-google-to-use-gmail-for-email
- Connect personal inbox: https://help.gohighlevel.com/support/solutions/articles/155000005066-getting-started-connect-personal-inbox
- Gmail sync (personal or Workspace): https://ideas.gohighlevel.com/changelog/introducing-the-gmail-2-way-email-sync
- Linked and conflict calendars: https://help.gohighlevel.com/support/solutions/articles/155000002374-setting-up-linked-calendars-conflict-calendars
- Google Meet location: https://help.gohighlevel.com/support/solutions/articles/155000002706-multiple-meeting-location-selector-in-calendar
- Quo + HighLevel: https://support.quo.com/core-concepts/integrations/high-level
- LC Phone: https://help.gohighlevel.com/support/solutions/articles/48001223556-lc-phone-system
- Porting: https://help.gohighlevel.com/support/solutions/articles/48001211919-porting-options-us-in-app-vs-international-manual-process
- A2P brand: https://help.gohighlevel.com/support/solutions/articles/155000008140-registering-your-a2p-brand
- A2P campaign: https://help.gohighlevel.com/support/solutions/articles/155000004539-campaign-registration-step-by-step-guide-and-faqs
- A2P fees: https://help.gohighlevel.com/support/solutions/articles/155000005200
- A2P rejections: https://help.gohighlevel.com/support/solutions/articles/155000007572-a2p-campaign-rejections-required-fixes-vetting-errors
