# AI Jewelry Form Builder

A form builder for custom jewelers. The jeweler's customer goes through a step-by-step form (piece, style, metal, stones, budget, their idea, an inspiration photo), leaves their contact details and gets an AI render of their piece, which they can refine in plain words. Every finished form lands with the jeweler as a lead with the render attached.

Runs entirely on Cloudflare: one Worker, D1 (database), R2 (images).

**Want your own copy online?** Follow [DEPLOY.md](DEPLOY.md): step by step in the Cloudflare and GitHub dashboards, no terminal needed, your keys stay in Cloudflare.

## What is in here

- **Builder** (`/builder`, or `builder.<your-domain>/`): opens on **All forms** (every client and their forms with leads, renders, last lead and AI cost, search, archive and restore). Forms are created from templates (Custom Enquiry, Grillz, Ring, Blank, or one piece only), with default and custom questions, an image and an AI note per option, theme colors, logo, texts, live preview, embed code and a **History** tab (every Save keeps the previous version, last 50). **Test render** in the preview renders the current draft without creating a lead (cost is tracked).
- **Customer form** (`/f/<form-id>`): the widget the builder embeds on a jeweler's site with one `<script>` tag. Back button and clickable finished steps. Includes a tooth picker for grillz (tap teeth, counters, popular sets) that sends the exact teeth to the image model. After the render the customer can refine the whole image or **paint over one area** and change only that (sent to the model as a mask). The budget guides the render: the piece is designed at the top of the chosen range.
- **Client portal** (`/portal`): each client gets a **portal link** (one year, shown once, new link revokes the old one) to see their leads, renders and forms on their own, without AI costs. **Client portal** in the builder opens the same portal for an admin (one hour, logged).
- **Leads admin** (`/admin`): leads with every render and its cost, test renders, and demo requests you can mark as handled.
- **Archive**: archived forms and clients disappear from the lists and stop taking new leads; nothing is deleted.
- **Onboarding**: New form → **Send onboarding form** gives the client a link to a guided setup in their portal: store, logo and color, the pieces they make, then **each piece in turn** (its styles with their own photos, its metals, karats, stones and budget ranges, and its details such as chain length, ring center stone or grillz cut, plus their own questions), then **shop products** and notes. It saves as they type; when they press Send you get a notification (bell in the builder) and **Create form from it** builds the form, photos included. The same link then opens their normal portal.

Onboarding color and theme choices apply only to the customer form preview. **Your website background** starts dark or light with the selected form theme and can be overridden for that preview. Custom metals include a color swatch, saved with the onboarding and carried into the real form. The grillz selector uses the approved teeth-only artwork with the same T1–T10/B1–B10 answer IDs as before.
- **Per piece, not show/hide**: every choice question can offer different options per piece (`perPiece` on the field: `{ "grillz": ["yellow-gold", "white-gold"] }`, an empty list skips the question for that piece). In the builder: Pieces & styles → pick a piece → **Options for <piece>** (tick what it offers) and **Questions only for <piece>** (added to that piece's own Details step). Forms from onboarding get one Details step per piece.
- **Shop products**: products from the jeweler's shop (photo, name, price, link, short description, which pieces they go with) shown under the customer's AI preview, matched to the piece they designed first, up to 6. Added in onboarding or in the builder's **Shop products** tab; the title above them is `result.productsTitle`. Check: `node scripts/per-piece-check.mjs`.
- **Monthly AI budget per client**: $50 per calendar month (UTC), or `CLIENT_MONTHLY_BUDGET_USD` as a Cloudflare Variable. It never stops renders: the admin gets one bell notification per client and month when it is passed, All projects shows "This month $X / $50" per project (plus a Total row under every project's table), and the client portal shows the month's usage with a progress bar. Check: `node scripts/monthly-budget-check.mjs`.
- **Display conditions** (Edit question → "Show this question"): the first condition is `showIf` (often the piece), **+ Add condition** adds more (`andIf`), and all of them must hold. Modes: *is one of the ticked answers* (`in`), *is answered, but not with a ticked one* (`notIn`), *is not a ticked answer (or not asked)* (`not`); the ? next to "Show this question" explains them with examples. Answers to questions that become hidden are removed in the form and on the server, also across steps (How iced = None hides Stones, which hides Clarity). Shared logic: `public/step-rules.js`.
- **Rules built into templates and onboarding**: Karat is skipped for metals without karats (platinum, stainless steel, dental gold, silver, titanium, tungsten, also custom metals with those words). Dental gold carries no stones: Stones and How iced? are skipped for it (`NO_ICE_METALS`, `noIceCondition`, also custom metals with "dental" in the name), the server drops ice answers sent with it, and the prompt says Not iced. Grillz Cut is only offered when the grill is not iced (`andIf: coverage not accents/half/full`).
- **Lettering style** (`font` question, `lettering: true`): 10 fonts in one list, each showing the customer's own text, plus Per request with a "describe the font" box. Fonts are OFL, served from `/fonts/lettering/`, list in `public/lettering.js`; the AI gets a description of the letter shapes next to the inscription.
- **Highlight video** (Brand & look → Highlight video): Off, **Automatic** (`auto`: starts as soon as the first picture is ready, the customer sees a video tile under the picture that fills up while it is made and turns into "Watch"; later versions get a "Create" tile), a customer button "Generate a highlight video of your piece", or only for the jeweler (made after the first render, shown with Download in the portal lead). Needs `PIKA_API_KEY` on the Worker (Pika H3 Flex, image to video, 10 s, 768p, the piece turns gently about 15° left and right and settles back at the starting angle; the picture is both `image` and `last_frame_image`, so it loops. The model has no negative prompt and draws every word it gets, so `filmDescription` describes only what is in the picture (caps, metal, cut, stones and letters only when they exist), never "no stones, no text", and the prompt says the design stays exactly as in the picture in every frame); about $0.20 per video, up to 2 per lead, counted in the daily and monthly budgets. The key alone turns on only the video: renders stay on the OpenAI/Gemini models. `PIKA_IMAGES=1` (Worker variable) also moves the images to Pika (Nano Banana Pro, black cinematic scene). Check: `scripts/film-check.mjs` (see its header; with and without `PIKA_IMAGES`).
- **Daily budgets** (off by default since 16.11, Ognjen: no limit for pictures and videos; `RENDERS_PAUSED=1` still stops everything): `FORM_DAILY_BUDGET_USD` (per form) and `DAILY_BUDGET_USD` (everything), when set, count pictures, refinements, try-ons and videos since midnight UTC; when one is used up, the customer gets "Previews are paused" and the portal shows "No render yet" (16.11: District's last leads of the day). An automatic video (auto/backend) starts only while at least 30% of both budgets is left (`filmRoom`, `FILM_BUDGET_SHARE` in `src/guard.js`), so videos never take the money for pictures. `/api/admin/render-stats` shows today's spend per form against the limits, leads without a picture in the last 24 h and the latest render and video errors. A picture costs about $0.14 on 2.6 Flare high (measured with real token counts), a video $0.20.
- **Client portal (16.11)**: stats on top (leads, renders, videos, average picture and video time); a clock with the seconds under every picture and video (`renders.ms`, video = Pika `runtime_s`); tap a day in "Leads per day" (or pick a date) to see only that day's leads (`/api/portal/leads?day=YYYY-MM-DD&tz=`), "All days" to go back.
- **Price calculator** (portal, District 16.11, grillz by their real price list 18.11): **Pricing** tab where the jeweler enters their own prices (saved in `clients.data.pricing`, keys lowercase; prices can also be changed from the admin view of the portal). **Grillz** use the jeweler's price list (`pricing.grillz`, District's list in `docs/district-price-list/`, `DISTRICT_GRILLZ` in `public/pricing.js`, migration 0021): sets top + bottom (6 or more teeth on each row; unequal rows = half of each set), "bottom or top only" by tooth count (2 fangs & backbar, 2, 3, 4, 6, 8, 10, 12; a count not on the list = next size up that has a price in that metal), columns 10K / 14K / 18K / silver / platinum, dental gold sets and rows, iced price per tooth (lab, natural SI1, natural VVS1 in 10K / 14K / silver; 18K and platinum = 14K + plain metal difference; VS = between SI1 and VVS1), moissanite = silver pave sets (other metals add the plain metal difference, one row = half a set), half iced = halfway and accents = a quarter of the way from plain to fully iced, additions per tooth (dental gold has its own "designs" list), molding fee once. Grillz prices are final (no markup); anything not on the list shows as a note under the estimate instead of a number. **Other pieces** keep the per-gram formula (pure gold per gram with karat purity, metal per gram, grams and labor per piece, stones per coverage level, markup). Next to every lead: (a) the estimate and (b) "Fits the budget": the closest specs under the budget's top, changing in this order: cheaper stones, lower karat, less ice, cheaper metal (dental gold drops the stones). Check `scripts/pricing-check.mjs` (every District list price is asserted). No prices = no number. Questions for the jeweler: `docs/pricing-questions-district.md`. "Fill suggested prices" fills empty fields with `SUGGESTED_PRICING` (grillz = District list; other pieces from gold $124/g on 16.11.2026). A free gold price without a key exists (`https://api.gold-api.com/price/XAU`, per troy ounce), not wired in.
- **Quote workbench** (portal, 18.11): the calculator next to every lead has a budget bar (customer's range shaded, price as a dot) and "How it's priced" on click. "Fits the budget" starts from the suggestion and the jeweler adjusts metal, karat, top/bottom teeth, how iced, stones, clarity and cut as chips; the price slides to the new number and tags show what changed from the customer's picks (Reset goes back to the suggestion). "Generate quote message" posts the final specs and price to `POST /api/portal/leads/:id/quote`; the Worker asks Workers AI (`AI` binding in `wrangler.jsonc`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) for a short text-message quote and keeps it only if it has the exact price and no other amount, otherwise it returns a standard message (`source: template`). Nothing is saved or sent: an orbit/shimmer animation while it writes, words fade in, then the text is editable with a Copy button. Check `scripts/quote-check.mjs`.
- **Finished in the background**: a cron every 5 minutes (`*/5 * * * *`, `catchUp` in `src/worker.js`) makes the first picture for leads without any render (older than 3 min, newer than 24 h; leads whose render failed are not retried), starts the video for forms with automatic video, and downloads finished videos, so a customer who closed the page early still has a picture and video in the portal for outreach.
- **Silent video**: Pika always adds sound; `src/mp4.js` removes the audio track before saving (MP4 boxes, offsets fixed when moov comes first; check `scripts/mp4-check.mjs`, needs ffmpeg). Videos made before 16.11 still have sound; the form and portal play them muted.
- **Render speed** (goal: almost always under 9 s): `GET /api/admin/render-stats?days=7` (admin only, open it in the browser while signed in to /admin) lists the real times from `renders.ms` per model, piece and kind (first render, refine, try-on): count, median, p90, max and the share under 9 s, plus the models in use. `IMAGE_QUALITY` (Cloudflare variable, no deploy: `low`, `medium`, `high`, default `high`) sets the quality of renders and refinements; lower quality means fewer output tokens, so faster and cheaper. Try-on keeps its own extra-high quality.
- **Tooth map**: every grillz render with selected teeth gets a reference image made on the server (`src/teethmap.js`, plain PNG, no canvas): a flat front view of both rows, selected teeth filled in the metal color, the others only outlined, lower teeth narrower. The prompt says it is a layout guide only. This replaced counting after the render (Ognjen 16.11).
- **Tooth count check** (off; `TEETH_CHECK=1` turns it back on): the customer sees the first grillz render right away; then the form calls `POST /api/leads/<id>/check` and a cheap vision model (`COUNT_MODEL`, default `gpt-5-mini`) counts the caps per row. If they differ from the selection, one corrected render quietly replaces the first picture ("Updated to match the teeth you selected"), unless the customer already asked for a refinement. `renders.checking` (1 waiting, 2 running) marks it; a reload picks the check up again. It runs in the form's request, not `waitUntil`, because a Worker keeps background work only about 30 s after the response. `TEETH_CHECK=0` turns it off; a failed count never blocks the render. Local: `MOCK_CAPS="7,0;6,0" node scripts/mock-openai.mjs 8899`.
- **Stones only outside, Not iced**: every render and every refinement carries the rule (`INSIDE_RULE` in `src/prompt.js`), also when the customer asks for ice only in their description or a refinement; the prompt keeps skin-side surfaces plain (inside of a ring band, back of a pendant, inner side of a bracelet, back of grillz caps). How iced? = None says "Not iced" outright, even for styles that are usually iced. "925 Silver" in Karat makes the metal 925 sterling silver (a gold color becomes plating).
- **"Other" with a text box** (Edit question → under the options, "Add "Other" where the customer types their own answer"; `writeIn: true`, optional `writeInLabel`, up to 30 characters): adds one last choice; picking it shows a required "Please describe" box. The text is saved as `<id>__more` (portal, email) and reaches the AI as the answer (also for metal, karat, stones). The server refuses Other without text and drops leftover text when another choice is picked. Not for lettering or style questions; an option may not already use the ID `other`. Check: `node scripts/writein-check.mjs`.
- **Choice pictures follow the metal** (`metalArt` in `public/option-art.js`): a choice can have one picture per metal color, `public/library/options/<category>/<piece>/<yellow|white|rose>/<slug>.webp`, and the form shows the one for the metal the customer picked (Silver, Platinum, White gold = white; Rose = rose; the rest yellow; yellow before a metal is chosen). Grillz cuts (10) and stone settings (Pave, Straight, Mosaic, Invisible, Jumbo) have them, made by Codex from District's reference photos on dental models (sources and prompts in `~/Desktop/jewelrylead-katalog/district-grillz/`). It works for library pictures and choices without a picture (also after "No image"), never over the jeweler's own photo. Add new ones with `python3 scripts/install_metal_art.py <folder of slug--family.jpg> --piece grillz`, then `scripts/build_option_index.py`; the Studio Light twins go to `public/library-light/` with the same paths.
- **Default AI descriptions of cuts and settings** (`CHOICE_NOTES` and `choiceNote()` in `src/prompt.js`): when a jeweler has not written an AI note, a choice gets a built-in description by its label (Weed cut = upwards leaf cut pattern, Starburst = star slash cuts with a dusted background, Invisible = princess cut stones in straight rows with no prongs, and so on, from District's jeweler). The jeweler's own note always wins.
- **Tooth picker colors**: unselected teeth are see-through (opacity .38) so white metals stand out; a custom metal whose label names a known metal (gold, silver, platinum, rose...) colors the teeth by that family before its swatch dot.
- **Portal by day**: leads are grouped under day headings with the count for that day ("Today · Monday, Nov 16 · 5 leads"), and a "Leads per day" bar chart shows the last 14 days. The day follows the browser's time zone (`/api/portal/leads?tz=<minutes>` returns `days: { "YYYY-MM-DD": { formId: n } }` for the last 90 days with the same filters). Every change the customer asked for is listed in full under the thumbnails, and the zoomed picture shows its text.
- **No environment reflections**: every render and refinement prompt forbids reflected windows, doors, rooms and softboxes in the metal (`NO_ENV_REFLECTIONS` in `src/prompt.js`).
- **Grillz try-on**: after a grillz render the customer can upload a smiling photo and see themselves wearing the design (2 per lead, photos stay private: customer via their lead token, the jeweler and admin). Turn it off per form in Pieces & styles.
- **Style library** (`public/library/`): reference images per style, sent to the model with the prompt so the shape comes out right.

Image models (pick per environment in `wrangler.jsonc`, keys in `src/worker.js` `MODELS`):

| key | model | notes |
| --- | --- | --- |
| `gpt26flare` | GPT Image 2.6 Flare | default for first render and refinements, ~$0.065, ~10 s; falls back to `gptflare` if OpenAI rejects the model |
| `gpt26sun` | GPT Image 2.6 Sunburst | accurate but slow, ~40-75 s; falls back to `gptsun` |
| `gptflare` | GPT Image 2.5 Flare | previous default, ~$0.065, ~20 s |
| `gptsun` | GPT Image 2.5 Sunburst | grillz and try-on (exact tooth count), ~35-40 s |
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
node scripts/writein-check.mjs       # Other with a text box, default cut notes, pictures per metal
node scripts/prompt-coverage-check.mjs [form.json]  # every choice of every piece reaches the AI prompt (templates, or a form saved from /api/forms/<id>)
node scripts/platform-check.mjs      # clients, forms, uploads (server must run)
node scripts/viewas-check.mjs        # client portal sessions (server must run)
node scripts/multi-onboarding-check.mjs # one onboarding per form, phone field, offered answers (server must run)
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

## Izbori, koraci i onboarding (1.11.2026)

- **Pieces & styles je jedino mjesto za sadržaj forme.** Kartica Questions ne postoji: svaki komad pokazuje svoje korake, pitanja i opcije. Edit otvara stakleni popup sa tabovima za sva pitanja tog komada (Metal, Karat, Stones...), postavkama koraka i slikama opcija.
- **Slike izbora:** `public/library/options/<kategorija>/<slug>` (`.webp` AI fotografije iz `scripts/option_art_spec.py`, `.svg` tačni crteži iz `scripts/build_option_diagrams.py`). Poslije izmjene pokrenuti `scripts/build_option_index.py`. `public/option-art.js` bira sliku po pitanju i natpisu opcije, pa izbor bez svoje slike dobija sliku i u formama koje već rade (`publicForm`). Vlastita slika opcije uvijek ima prednost.
- **Slike po komadu:** `public/library/options/<kategorija>/<komad>/<slug>.webp` (Codex, `scripts/option_art_pieces_spec.py`) imaju prednost nad opštom slikom: metal, pokrivenost kamenjem, a za prsten i kamenje i veličina. Forma ih bira po izabranom komadu preko `pieceArt` na opciji.
- **Required step:** `step.required` = bar jedan odgovor, `field.required` = to pitanje, `step.optionalFor` = komadi za koje ni jedno ne važi (`public/step-rules.js`, koriste ga forma i server).
- **Grillz:** izbor zuba je uvijek vidljiv. Gotov stil označi svoje zube, kupac ih može mijenjati, a server čuva kupčev izbor (`public/grillz-selection.js`). Stil sa fotografijom zlatara bez poznatog rasporeda ne traži zube.
- **Onboarding provjera:** `public/onboarding-check.js` dijele portal i server. Portal piše šta ne valja, vodi na tačno polje i ne šalje dok se ne ispravi; server odbija isto (422) i uz to pravi probnu formu, da "Create form from it" ne može pasti.
- **Dodavanje:** u onboardingu se dodaju i karati i opcije specifikacija, ne samo metali i kamenje. "Quick add" nudi `SUGGESTED` (`public/option-suggestions.js`, isti spisak u builderu kod svakog dodavanja) i izbore iz ranijih onboardinga (samo natpisi, nikad tuđe fotografije ni opisi).

## Projekti, onboarding po formi i kraj forme (1.11.2026)

- **Hub:** New project stoji iznad projekata, New form u svakom projektu. Leads i Test render su izbačeni iz buildera (`/admin` i dalje radi, otvara ga obavještenje o zahtjevu za demo; `/api/admin/test-render` nema dugme).
- **Onboarding po formi:** New form → Send onboarding pravi novi nacrt (`fresh: true`) sa imenom forme. Portal link je isti za projekat, a `?onboarding=<id>` bira onboarding (`pickOnboarding`). Dok od onboardinga nema forme, on je red u tabeli projekta: Review onboarding dok klijent popunjava, Edit kad pošalje. Edit pri prvom kliku pravi formu pa je otvara.
- **Client portal:** dugme otvara portal kao klijent (view-as, samo čitanje, log), ikonica kopira stalni link. Zamjena i gašenje linka su u kartici Client.
- **Limit znakova:** `LIMITS` u builderu i `OB_LIMITS` u portalu su isti kao `validateFormDef` i `cleanOnboarding`. `JLUI.watchLimits()` pokazuje brojač dok se kuca (popover, jer otvoren dijalog prekriva sve ostalo).
- **Telefon:** `public/phone.js`, sve zemlje bez biblioteke, +1 podrazumijevano, zapis `+1 (555) 123-4567`. Zalijepljen `+387 ...` sam bira zemlju.
- **Izbori ispod rendera:** `picksView()` u formi, slika izbora ili ikonica, naziv pitanja i odgovor.
- **Budžet bez slika:** rasponi cijena su samo brojevi (Ognjenova odluka 6.11.2026). Slike poluga i prstenova za budžet su obrisane, `NO_ART` u `option-art.js` ne dodjeljuje sliku budžetu, a stara upisana putanja `/library/options/budget/` se ignoriše. Ne generisati ih ponovo.
- **Uklanjanje slike u editoru:** dugme `Remove image` (kartica komada, stil) ili `No image` (opcija), i `No image` u biblioteci slika, postavlja `noImage: true` i briše vlastitu sliku, pa ni automatska slika ne stoji. `Use default image` vraća automatsku. Vlastita slika uvijek pobjeđuje `noImage`. Zajedničko: `styleImage` i `optionArt` u `option-art.js`.
- **Slike po nazivu:** stil bez slike dobija je iz `public/library/<komad>/` preko `styleArt(komad, naziv)` u `option-art.js` ("Figaro chain" i "Figaro" su isti stil), u formi, rendersu, builderu i Quick add u onboardingu, bez upisa u bazu; slika koju je zlatar stavio ima prednost. Dodati komadi su u `public/library/pieces/`. Ručno dodato pitanje dobija slike po tekstu pitanja (`artField`): Finish, Stone setting, Clasp, Stone color, Engraving. Nove slike: `scripts/build_missing_art.py` pa `scripts/build_option_index.py`; `scripts/style-art-check.mjs` provjerava da sve ponuđeno ima sliku. Veličina kamena na minđušama je jedan kadar skaliran po prečniku (`scripts/build_carat_studs.py`). Marke satova i zdravstvena pitanja namjerno nemaju slike.
- **Čekanje rendera:** `forgeShots`, `forgeScene`, `forgeView`, `forgeTick` i `forgeFinish` u formi, klase `.at-*` u `form.css`. Svaki izbor ima makro kadar iz `public/library/details/<komad ili shared>/<kategorija>/<slug>[-<boja>].webp`; kamera 4 s klizi preko kadra, pa pretapanje u sljedeći, bez efekata. Boja (`yellow`, `white`, `rose`) prati izabrani metal. Žig karata: prsten koristi `shared/karat` (unutrašnjost prstena), ostali komadi `tag/karat` (pločica na kopči), a grillz zadržava običnu sliku izbora. Kadrovi: `scripts/build_details.py` (Codex, po 8, postojeće preskače), pa `scripts/build_option_index.py`. Izbor bez kadra koristi običnu sliku izbora. Dorada klizi preko trenutnog rendera. Stanje se računa iz proteklog vremena.

## Stil slika forme: Studio Dark i Studio Light (9.11.2026)

- **Izbor:** onboarding (korak prodavnice, "Picture style" ispod "Look") i builder (Brand & look → Picture style). Sačuvano kao `imageStyle: 'light'` na formi (`dark` je podrazumijevano i ne upisuje se u javnu formu). `validateFormDef` prima samo `IMAGE_STYLES` (`dark`, `light`).
- **Slike:** Studio Light je `public/library-light/` sa ISTIM putanjama kao `public/library/` (307 slika, Codex iz Studio Dark slike kao reference, `~/Desktop/jewelrylead-katalog/_generisi.py`). Forma u `art()` (form.js) mijenja `/library/` u `/library-light/`; makro kadrovi (`details/`) i SVG crteži ostaju isti. Slika komada Chain iz galerije sajta ima svoj par `library-light/pieces/chain-category.webp` (`LIGHT_EXTRA`).
- **Nova slika u biblioteci** mora dobiti i svijetli par; dok ga nema, forma sama pada na tamnu sliku (listener na `error`). `scripts/image-style-check.mjs` javlja svaku sliku bez para.
- AI render i dalje šalje modelu tamnu sliku kao referencu oblika; pozadinu rendera bira polje "Render background".
