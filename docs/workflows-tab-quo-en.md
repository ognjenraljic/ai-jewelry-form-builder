# Workflows tab and Quo texts: setup for District

*November 28, 2026. How to set up the new Workflows tab in the JewelryLead portal, how to make each GoHighLevel workflow report that it ran, and how to send texts from Quo until the number is ported to GoHighLevel.*

## What the Workflows tab shows

Portal → **Workflows**. It covers the three flows (Quote follow-up, Appointments, Pick up and review), each drawn as a chain of steps:

- **Off** (grey): Automations are off, or this one step is turned off.
- **Not connected** (grey, dashed): nothing is connected that could send it.
- **Waiting** (dashed): JewelryLead is ready, but the GoHighLevel workflow for this step does not exist yet or is not published.
- **Published** (yellow): the GoHighLevel workflow is published, but it has not reported a run yet.
- **Live** (green, pulsing): the step has actually run. In GoHighLevel that means the workflow sent its "done" webhook. In Quo it means a text went out.
- **Error** (red): the last attempt failed. Click the step to see why.

Click a step to open its panel: when it is sent, which consent it needs, an on/off switch for that step, and, when texts go through Quo, the editable text with a preview. Below the flows is the **History**: every message, when it went out, to whom (masked number), through which channel (GoHighLevel or Quo), the text itself, and whether it was delivered, skipped (for example no SMS consent) or failed.

**Nothing is shown as Live until it really runs.** Right now everything is off or waiting. It turns Live on its own once you finish the steps below.

---

## Part 1: GoHighLevel (both channels need this)

### 1. Token scope
Settings → Private Integrations → your JewelryLead token → Edit → add the scope **View Workflows** → Save. The token itself stays the same; if GHL shows a new one, paste it in the portal (Forms → GoHighLevel).
In the Workflows tab, the GoHighLevel card should then show **View Workflows scope: OK**. This is how the portal knows which workflows are published.

### 2. Name each workflow exactly as its tag
The portal matches workflows by name. Name each one exactly as its tag, for example `jl offer 24h left`. The full list of tags is in the GHL workflows guide from November 27 (21 tags).

### 3. Last step of every workflow: the "done" webhook
Workflows tab → GoHighLevel card → **Ack webhook** → **Create webhook** (if it is not there yet) → **Copy**.
At the very end of each workflow, after "Remove Contact Tag", add:
- Action **Webhook** (the "Custom Webhook" action works too), Method **POST**, URL = the copied address.
- **Custom Data**: `event` = `jl_ack`, and `tag` = the workflow's tag (for example `jl offer 24h left`).

When a workflow reaches this step, its step in the portal turns **Live** and the history row gets a "confirmed" mark.

### 4. Text branch: who sends the text
When Quo sends the texts, every contact carries the tag `jl texts via quo`. GoHighLevel must then skip its own text so the customer does not get two. Change the If/Else in each workflow to three branches:

1. Contact has tag `jl texts via quo` **and** has the consent tag (`sms consent`, or `sms marketing consent` for sales messages) → no message (Quo already texted) → continue to Remove Contact Tag.
2. Contact has the consent tag → **Send SMS** (as before).
3. Everyone else → **Send Email** (as before).

Internal steps (tasks and notifications for Enrique, such as `jl refresh needs quote` and the task in `jl deposit click`) stay in GoHighLevel and do not change. When you switch back to GoHighLevel texts, the portal removes the `jl texts via quo` tag from contacts on its own, so branch 2 takes over again with no changes in GHL.

### 5. Publish and turn on
Publish the workflows. In the portal they move from **Waiting** to **Published** (the portal checks again when the tab is opened, at most every 10 minutes). Then in the Workflows tab turn on **Automations** (top right). Each step turns **Live** after its first real run.

---

## Part 2: Quo (texts until the number is ported)

### What this gives you
Texts to customers go out from District's existing Quo number, the one customers already know, without waiting for porting or for the GoHighLevel A2P registration. Emails, tasks and internal notifications still go through GoHighLevel. Replies, STOP and delivery receipts come back to the portal:
- **STOP** stops all texts to that number (Quo also blocks it on its side). **START** turns them back on.
- When a customer **replies** after getting their quote, quote follow-ups for that customer stop. Enrique answers in the Quo app as usual.
- Customers without SMS consent are skipped. Their row shows "no SMS consent".

### What it needs
- A Quo plan with the number. The API is not limited to a specific plan.
- **US carrier registration (A2P 10DLC) in Quo approved** for that number: Quo → Settings → Trust Center (or Business verification). Without it, Quo rejects the texts and the portal shows "Quo says your A2P registration is not approved yet".
- **Prepaid API credits** in Quo (Settings → Billing). API texts cost about **$0.01 per message segment**. When credits run out, the portal shows the error from Quo.
- The person creating the key must be the **Owner or an Admin** in Quo.

### Steps
1. Quo → **Settings → API** → **Generate API key** → copy it.
2. Portal → **Workflows** → card "Where texts are sent from" → **Quo SMS** → paste the key → **Connect**.
3. **Choose your number** (District's main Quo number). The portal creates the webhook in Quo for replies and delivery receipts on its own. "Replies and delivery" should show **On**. If it shows an error, press **Try again**. If it keeps failing, open "Set up the webhook by hand", create the webhook in Quo (Settings → Webhooks) at the address shown, for message received, delivered, failed and undelivered events, and paste its signing secret (`whsec_...`).
4. **Your name in texts**: for example `Enrique` (texts read "Hey Ava, it's Enrique from District..."). If empty, the store name is used.
5. **Google review link**: from the Google Business Profile ("Ask for reviews" → copy link, starts with `https://g.page/r/...`).
6. **Send test** to your own phone: exactly one text goes out, only to the number you typed, and it shows in the history.
7. Switch the channel to **Quo SMS** and turn on **Automations**.
8. Optional: click any step to adjust its text. Each customer's first text includes "Reply STOP to opt out" automatically.

### When the number is ported to GoHighLevel
1. Finish the GoHighLevel A2P registration for the ported number (see the November 27 setup guide).
2. Workflows tab → switch the channel to **GoHighLevel**. Texts move back to the GHL workflows (branch 2 from step 4), and the `jl texts via quo` tag is removed on its own.
3. Then **Disconnect** Quo in the same card. The portal also deletes the webhook it created in Quo.

---

## Quick checklist

| Who | What | Where |
|---|---|---|
| Enrique / GHL admin | View Workflows scope on the token | GHL → Settings → Private Integrations |
| Enrique / GHL admin | Name each workflow as its tag, add the final webhook with `event` / `tag`, three-branch text step | GHL → Automation → Workflows |
| Enrique (Quo Owner) | Quo API key, credits, A2P approved in Quo | Quo → Settings |
| Us or Enrique | Connect Quo, pick the number, sender name, review link, test, switch to Quo, turn on Automations | Portal → Workflows |

## Still to confirm live
- The Quo API and the GoHighLevel workflow list were tested against test servers that follow the official documentation. The first real Quo connect and test text will confirm it.
- Whether Quo's A2P registration for District's number is already approved (Quo → Settings).
