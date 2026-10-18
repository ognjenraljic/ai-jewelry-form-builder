# AI Jewelry Form Builder

A form builder for custom jewelers. The jeweler's customer goes through a step-by-step form (piece, style, metal, stones, budget, their idea, an inspiration photo), leaves their contact details and gets an AI render of their piece, which they can refine in plain words. Every finished form lands with the jeweler as a lead with the render attached.

Runs entirely on Cloudflare: one Worker, D1 (database), R2 (images).

## What is in here

- **Builder** (`/builder`, or `builder.<your-domain>/`): clients (jewelers), forms created from templates (Custom Enquiry, Grillz, Ring, Blank), default and custom questions, an image and an AI note per option, theme colors, logo, texts, live preview and the embed code.
- **Customer form** (`/f/<form-id>`): the widget the builder embeds on a jeweler's site with one `<script>` tag. Includes a tooth picker for grillz (tap teeth, counters, popular sets) that sends the exact teeth to the image model.
- **Client portal** (`/portal`): "View as client" from the builder shows the jeweler's leads and forms exactly as they see them (one-hour session).
- **Leads admin** (`/admin`).
- **Style library** (`public/library/`): reference images per style, sent to the model with the prompt so the shape comes out right.

Image models (pick per environment in `wrangler.jsonc`, keys in `src/worker.js` `MODELS`):

| key | model | notes |
| --- | --- | --- |
| `gptflare` | GPT Image 2.5 Flare | default first render, ~$0.065, ~20 s |
| `gptsun` | GPT Image 2.5 Sunburst | same quality, ~37 s |
| `gpt2` | GPT Image 2 | ~$0.22, ~90 s |
| `pro` | Nano Banana Pro (Gemini 3 Pro Image) | ~$0.16, ~25 s |
| `flash` | Nano Banana (Gemini 2.5 Flash Image) | default for refinements, cheapest |

Costs are estimates from token usage and change with provider pricing.

## Run locally

Requires Node 18+.

```bash
npm install
./dev.sh
```

The first run creates `.dev.vars` with a random `ADMIN_TOKEN` (you sign in to the builder with it) and `DEV_MODE=1`. Add your image API keys without them appearing on screen:

```bash
./set-key.sh GEMINI_API_KEY
./set-key.sh OPENAI_API_KEY
```

Then open http://127.0.0.1:8797 (builder) or http://builder.localhost:8797. `DEV_MODE=1` shows a model picker and cost under each render; never enable it in production.

## Embed a form

Copy the snippet from the builder's Embed tab:

```html
<div id="karatly-demo"></div>
<script src="https://<your-worker-domain>/embed.js" data-form="demo" data-target="karatly-demo" async></script>
```

Works on WordPress, Shopify, Wix and plain HTML (anywhere you can paste HTML).

## Deploy to Cloudflare

```bash
npx wrangler d1 create konfigurator          # put the returned database_id into wrangler.jsonc
npx wrangler r2 bucket create konfigurator-media
npx wrangler d1 migrations apply konfigurator --remote
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

API keys only ever live in `.dev.vars` (local, git-ignored) or Worker secrets. If Gemini answers "User location is not supported", add a placement region to `wrangler.jsonc` (for example `"placement": { "region": "aws:us-east-1" }`).

## Checks

```bash
node scripts/templates-check.mjs     # every template passes validation
node scripts/prompt-check.mjs        # prompt building (notes, hidden questions, tooth picker)
node scripts/platform-check.mjs      # clients, forms, uploads (server must run)
node scripts/viewas-check.mjs        # client portal sessions (server must run)
RENDER=1 node scripts/teeth-check.mjs  # tooth picker through the server + one render
```

`scripts/build_library.py` regenerates the style library images with Gemini (reads the key from `.dev.vars`).

## Notes

- Code comments are in Serbian.
- Customer photos are stored in R2 and are readable only by the admin or the owning client's portal session. Uploaded builder images must be JPG, PNG or WebP (no SVG).
- Before production: rate limiting per IP is basic, there is no email notification for new leads yet, and `DEV_MODE` must be off.
