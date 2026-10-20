# AI Jewelry Form Builder

A form builder for custom jewelers. The jeweler's customer goes through a step-by-step form (piece, style, metal, stones, budget, their idea, an inspiration photo), leaves their contact details and gets an AI render of their piece, which they can refine in plain words. Every finished form lands with the jeweler as a lead with the render attached.

Runs entirely on Cloudflare: one Worker, D1 (database), R2 (images).

**Want your own copy online?** Follow [DEPLOY.md](DEPLOY.md): step by step in the Cloudflare and GitHub dashboards, no terminal needed, your keys stay in Cloudflare.

## What is in here

- **Builder** (`/builder`, or `builder.<your-domain>/`): opens on **All forms** (every client and their forms with leads, renders, last lead and AI cost, search, archive and restore). Forms are created from templates (Custom Enquiry, Grillz, Ring, Blank, or one piece only), with default and custom questions, an image and an AI note per option, theme colors, logo, texts, live preview, embed code and a **History** tab (every Save keeps the previous version, last 50). **Test render** in the preview renders the current draft without creating a lead (cost is tracked).
- **Customer form** (`/f/<form-id>`): the widget the builder embeds on a jeweler's site with one `<script>` tag. Back button and clickable finished steps. Includes a tooth picker for grillz (tap teeth, counters, popular sets) that sends the exact teeth to the image model. After the render the customer can refine the whole image or **paint over one area** and change only that (sent to the model as a mask). The budget guides the render: the piece is designed at the top of the chosen range.
- **Client portal** (`/portal`): each client gets a **portal link** (one year, shown once, new link revokes the old one) to see their leads, renders and forms on their own, without AI costs. "View as client" opens the same portal for an admin (one hour, logged).
- **Leads admin** (`/admin`): leads with every render and its cost, test renders, and demo requests you can mark as handled.
- **Archive**: archived forms and clients disappear from the lists and stop taking new leads; nothing is deleted.
- **Onboarding**: New form → **Send onboarding form** gives the client a link to a guided setup in their portal (store, logo and color, pieces, styles with their own photos, metals, stones, budget, notes). It saves as they type; when they press Send you get a notification (bell in the builder) and **Create form from it** builds the form, photos included. The same link then opens their normal portal.
- **Grillz try-on**: after a grillz render the customer can upload a smiling photo and see themselves wearing the design (2 per lead, photos stay private: customer via their lead token, the jeweler and admin). Turn it off per form in Pieces & styles.
- **Style library** (`public/library/`): reference images per style, sent to the model with the prompt so the shape comes out right.

Image models (pick per environment in `wrangler.jsonc`, keys in `src/worker.js` `MODELS`):

| key | model | notes |
| --- | --- | --- |
| `gptflare` | GPT Image 2.5 Flare | default for first render and refinements, ~$0.065, ~20 s |
| `gptsun` | GPT Image 2.5 Sunburst | same quality, ~37 s |
| `gpt2` | GPT Image 2 | ~$0.22, ~90 s |
| `pro` | Nano Banana Pro (Gemini 3 Pro Image) | ~$0.16, ~25 s |
| `flash` | Nano Banana (Gemini 2.5 Flash Image) | cheapest, optional for refinements (`TWEAK_MODEL`) |

Costs are estimates from token usage and change with provider pricing.

## Run locally

Requires Node 18+.

```bash
npm install
./dev.sh
```

The first run creates `.dev.vars` with a random `ADMIN_TOKEN` (you sign in to the builder with it) and `DEV_MODE=1`. Add at least one image API key (see **API keys** below), then open http://127.0.0.1:8797 (builder) or http://builder.localhost:8797. `DEV_MODE=1` shows a model picker and cost under each render; never enable it in production.

## Embed a form

Copy the snippet from the builder's Embed tab:

```html
<div id="jewelrylead-demo"></div>
<script src="https://<your-worker-domain>/embed.js" data-form="demo" data-target="jewelrylead-demo" async></script>
```

Works on WordPress, Shopify, Wix and plain HTML (anywhere you can paste HTML).

## API keys (never in this repo)

The repo contains **no API keys**. Every deployment uses its owner's own keys, stored outside the code:

| where | what holds the keys | visible in GitHub? |
| --- | --- | --- |
| your computer | `.dev.vars` (git-ignored, created by `./dev.sh`) | no |
| Cloudflare | Worker **secrets** (encrypted, write-only) | no |

Never put an API key in `wrangler.jsonc`, in the code, in a commit, or in GitHub Secrets. The OpenAI and Gemini keys only need to exist in Cloudflare.

| secret | needed for | where to get it |
| --- | --- | --- |
| `OPENAI_API_KEY` | GPT Image models (all renders by default) | https://platform.openai.com/api-keys |
| `GEMINI_API_KEY` | Nano Banana models (optional) | https://aistudio.google.com/apikey (billing must be on for image models) |
| `ADMIN_TOKEN` | signing in to the builder and admin | any long random string, e.g. `openssl rand -hex 24` |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` | optional bot check on the form and the demo request | Cloudflare dashboard → **Turnstile** → Add widget (your domain) |

One image key is enough: without `OPENAI_API_KEY` all renders use Gemini, without `GEMINI_API_KEY` all renders use GPT Image 2.5 Flare.

### Set the keys locally

```bash
./set-key.sh OPENAI_API_KEY    # paste the key, it is not shown on screen
./set-key.sh GEMINI_API_KEY
```

Running it again replaces the old value. Restart `./dev.sh` afterwards.

### Set the keys on Cloudflare

**Option A, dashboard (no terminal):**

1. Cloudflare dashboard → **Workers & Pages** → open the `ai-jewelry-form-builder` Worker.
2. **Settings** → **Variables and Secrets** → **Add**.
3. Type: **Secret**. Name: `OPENAI_API_KEY`. Value: your key. Save and deploy.
4. Repeat for `GEMINI_API_KEY` and `ADMIN_TOKEN`.

**Option B, terminal:**

```bash
npx wrangler secret put OPENAI_API_KEY    # paste the key when asked
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

### Change (rotate) a key

1. Create a new key with the provider (links above).
2. Replace it: on Cloudflare run `npx wrangler secret put OPENAI_API_KEY` again, or edit the secret in **Settings → Variables and Secrets** (secret values cannot be viewed, only replaced). Locally run `./set-key.sh OPENAI_API_KEY` again.
3. Make one test render (open a form and finish it).
4. Delete the old key at the provider so it stops working everywhere.

If a key was ever pasted into a commit, chat or screenshot, treat it as leaked: rotate it right away.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create konfigurator          # put the returned database_id into wrangler.jsonc
npx wrangler r2 bucket create konfigurator-media
npx wrangler d1 migrations apply konfigurator --remote
npx wrangler deploy
```

Then add the secrets (see **API keys** above). Make sure `DEV_MODE` is not set in production.

To deploy automatically on every push, connect this repo in the Cloudflare dashboard (**Workers & Pages → your Worker → Settings → Builds → Connect**). The keys stay in Cloudflare secrets; nothing secret goes into GitHub.

### Spending limits and safety switches

Set these as plain **Variables** (Text) in **Settings → Variables and Secrets**. They are not in `wrangler.jsonc` on purpose (`keep_vars: true` keeps what you set in the dashboard on every deploy):

| variable | default | what it does |
| --- | --- | --- |
| `DAILY_BUDGET_USD` | `30` | estimated AI spend per day for the whole platform; above it new renders wait until tomorrow |
| `FORM_DAILY_BUDGET_USD` | `15` | the same limit per form, so one busy or abused form cannot use the whole budget |
| `RENDERS_PAUSED` | off | `1` stops all new renders right away (forms still collect leads) |

When a limit is hit, the admin gets one notification per day in the builder bell.

Built in, nothing to set: per-network lead limit (IPv6 by /64), text and photo moderation (OpenAI moderation, free), image type check on every upload, security headers (CSP, HSTS), forms can only be embedded on the sites listed in the form's Embed tab (empty = anywhere), `workers.dev` and preview URLs are off, and a nightly job (03:17 UTC) deletes customer selfies and try-on images older than 30 days.

Sign-in: the builder, `/admin` and the portal use HttpOnly cookies (30 days for admin). A portal link is exchanged for a cookie on the first visit and removed from the address bar.

If Gemini answers "User location is not supported", add a placement region to `wrangler.jsonc` (for example `"placement": { "region": "aws:us-east-1" }`).

## Checks

```bash
node scripts/templates-check.mjs     # every template passes validation
node scripts/prompt-check.mjs        # prompt building (notes, hidden questions, tooth picker)
node scripts/platform-check.mjs      # clients, forms, uploads (server must run)
node scripts/viewas-check.mjs        # client portal sessions (server must run)
RENDER=1 node scripts/teeth-check.mjs  # tooth picker through the server + one render
node scripts/versions-archive-check.mjs  # form history, archive, demo requests handled (server must run)
node scripts/hardening-check.mjs     # sign-in cookies, limits, moderation, uploads, portal, conflicts, cron (server + mock must run)
```

Renders without spending credit: start the fake OpenAI with `node scripts/mock-openai.mjs 8899 out.json`, then `npx wrangler dev --test-scheduled --var OPENAI_API_KEY:mock-local --var OPENAI_BASE:http://127.0.0.1:8899` (only works with `DEV_MODE=1`, and `DEV_MODE` only works on localhost). It returns gallery images, answers moderation (text containing `FLAGME` is flagged) and logs what the model received (images, mask, prompt).

`scripts/build_library.py` regenerates the style library images with Gemini (reads the key from `.dev.vars`).

## Notes

- Code comments are in Serbian.
- Customer photos are stored in R2 and are readable only by the admin or the owning client's portal session. Uploaded builder images must be JPG, PNG or WebP (no SVG).
- Not done yet: email notification to the jeweler for new leads (they see leads in the portal).
