# Competition rule book: Vultr Agent Rush Hackathon (lablab.ai)

Researched 2026-11-03. Pages were read through a fetch tool that summarises content, so wording is as reported by that tool, not a raw copy. Quotes in double quotes are as returned. Anything not found on a page opened is marked UNVERIFIED. The organizer may change rules ("may change or be canceled at our discretion", event page).

Sources (all opened):
- EVENT = https://lablab.ai/ai-hackathons/vultr-hackathon
- RULES = https://lablab.ai/hackathon-rules
- GUIDE = https://lablab.ai/ai-articles/hackathon-guidelines
- START = https://lablab.ai/getting-started-guide
- TOS = https://lablab.ai/terms-of-use

The event page says the event page and submission form override the defaults (RULES, START).

## 1. Dates and deadline

| Item | Finding | Source |
|---|---|---|
| Online build | 3-8 November 2026 | EVENT |
| On-site phase | 8 November 2026, Pierpont Place, 163 W Pierpont Ave, Salt Lake City, UT 84101 | EVENT |
| Format | Hybrid; online via lablab.ai platform and Discord, must register for both | EVENT |
| Schedule | "To be announced" | EVENT |
| Official submission deadline | UNVERIFIED. Not stated on the event page. | EVENT |
| Deadline mechanics (generic) | Submissions close at the event-page deadline with a five-minute grace period; only organizers can extend, contact them before the deadline | RULES |

Treat 8 November as a working deadline only. Check the event page again before submitting.

## 2. Eligibility and team size

- "Everyone is welcome to participate, regardless of previous AI or coding experience." (EVENT)
- Teams of 1-6 (EVENT). Solo participation allowed (START). Team size is set per event (START).
- Age: users must be "18 years or older" (TOS s3A). Not stated on the event page; applies via the Terms.
- Sanctions: users may not be located or resident in a US-sanctioned country (North Korea, Iran, Cuba, Russia named, list not exhaustive) or be on a restricted-persons list (TOS s11).
- Registration: lablab.ai profile with Discord connected, and membership of the lablab.ai Discord server, required before creating or joining a team (START). Some events need a registration form and organizer approval (START); whether this one does is UNVERIFIED.
- Organizers may participate but are not prize-eligible (RULES).
- Who may submit: "Only your team admin, and up to three teammates they choose, can submit." (START)

## 3. Tracks (challenges) and mandatory requirements (EVENT)

### Challenge 1: Blast Radius Zero
- Vultr Cloud Compute (VM) backend and web app deployed on Vultr.
- Vultr Serverless Inference for agent LLM calls: required.
- Isolated sandbox execution. Docker strongly recommended; OpenSandbox, gVisor, E2B, Microsandbox listed as examples.
- Containment focus: process isolation, secret hygiene, resource limits, lifecycle discipline.
- Must show at least one containment moment in the demo video.
- Patterns listed: sandboxed code execution and sandboxed browser use.

### Challenge 2: Powering the Future of Work
- Vultr VM backend and web deployment on Vultr.
- Serverless Inference optional.
- Must be accessible through a public web browser.
- Focus areas: sales ops, finance, HR, customer support, procurement.
- "Vultr GPUs are not available for this event."

Whether one entry may enter both tracks: UNVERIFIED.

## 4. Judging

- Criteria named on the event page: Application of Technology, Presentation, Business Value, Originality. No weights on the event page (EVENT).
- Default scale per RULES: each criterion scored 1 to 5; events and tracks can set their own criteria, weights and score ranges. Whether this event overrides: UNVERIFIED. Weights: UNVERIFIED.
- Judge names and judging stages: UNVERIFIED.

## 5. Prizes (EVENT)

- 1st: $5,000 cash + $3,000 Vultr credits
- 2nd: $3,000 cash + $1,000 Vultr credits
- 3rd: $1,000 cash + $1,000 Vultr credits
- Onsite raffle, 3 winners: PlayStation 5, Apple AirPods, or Razer mouse. Requires attending in person ("Three onsite attendees will each win").
- Totals stated: $14,000 competition prizes ($9,000 cash, $5,000 credits), "up to $15,000" including raffle; page also says "Up to $1,000 in onsite raffle prizes".
- Distribution "may take up to 90 days" (EVENT); prizes distributed within 90 days of winners' announcement (TOS s16).
- Payout terms (TOS s17): prizes go to individuals, not teams or entities; winners must submit documents within 90 calendar days of notification or forfeit; payments in USD by ACH (US) or SWIFT (non-US); documents are Prize Payout Form, government photo ID, W-9 (US) or W-8BEN (non-US), bank verification in winner's name; announced prize is gross, net may be lower. Non-US recipients: 30% US federal withholding unless a treaty applies and a US TIN is given on W-8BEN. US: 1099-MISC if over $600. TOS says "We do not charge any service or administrative fees" yet also lists a $15 US bank transfer processing fee (TOS internally conflicts).
- Prizes depend on "eligibility, availability and third-party sponsors" (EVENT); sponsor prizes not guaranteed by lablab.ai (TOS s16).

## 6. Remote entries and prizes

- Travel and accommodation are not covered (EVENT).
- The event page says online participation is supported and does not state that remote entrants are excluded from the 1st-3rd prizes. It does not affirmatively say they are eligible either. Treat as UNVERIFIED: whether a remote entry can win the cash/credit prizes.
- The raffle is in-person only (EVENT).
- Whether remote submissions are judged in the same pool as on-site ones: UNVERIFIED.
- Whether the on-site phase requires live pitching/demo at Salt Lake City: UNVERIFIED.

## 7. Submission artefacts and format limits

Required on lablab.ai for judging and prizes (EVENT): project title, short description, long description, technology and category tags, cover image, video presentation, slide presentation, public GitHub repository with setup and documentation, demo application platform, demo application URL. Also: public demo URL, recorded demo video, clear architecture and use-case explanation. README must explain the Vultr services and infrastructure used; no separate architecture report needed (EVENT). Vultr Community showcase is optional and does not replace the lablab.ai submission (EVENT).

Format limits: EVENT says "not stated". Defaults from other pages:
- Title: max 50 characters (GUIDE)
- Short description: up to 255 characters (GUIDE)
- Long description: minimum 100 words (GUIDE)
- Video: a link; "under 300MB and within 5 minutes duration" (GUIDE); MP4 or MOV (RULES)
- Slides: PDF (RULES). Slide count limit: UNVERIFIED.
- Cover image: 16:9 recommended (GUIDE); "optional, cropped to 16:9" (RULES). EVENT lists it as required, so supply one.
- GitHub repo: must be kept public (RULES). Multiple repos: mention in README (GUIDE).
- Failing to follow submission guidelines "may result in a lower score or exclusion from the hackathon." (RULES)

These defaults are not confirmed as applying to this event; the event page lists no limits.

## 8. IP, licensing, original work

- EVENT: "Submissions must be original and MIT-compliant."
- TOS s16: "All submissions by participants must be original work, open source, and compliant with the MIT License" unless stated otherwise. Implication for the builder: public, open-source repo with MIT-compatible licence and dependencies. (The implication is ours; the quoted text is the rule.)
- TOS s4D: "As between you and NativelyAI, you own Your Content."
- TOS s4C: users grant lablab.ai a "world-wide, perpetual, non-exclusive, royalty-free" licence to Your Content "for any purpose" (general platform clause).
- Rules on use of third-party code, AI-generated code, or pre-existing code: UNVERIFIED.

## 9. Disqualification and conduct

- "Unethical behavior, such as plagiarism or gaming the voting system, will lead to immediate disqualification." Removal also possible for cheating, tampering with systems, unauthorized automation, or fraud (RULES).
- Non-compliance with submission guidelines may lower score or exclude (RULES).
- Event-specific disqualification rules: EVENT states none. UNVERIFIED beyond the above.
- Not covered by RULES: eligibility, team size, IP, remote participation.

## 10. Vultr credits (EVENT)

Source: the event page https://lablab.ai/ai-hackathons/vultr-hackathon, read 2026-11-03.

- Each participant receives $200 in free Vultr credits to build and experiment during the hackathon.
- The email must not have been previously associated with a Vultr account.
- Steps on the page: create the account at https://www.vultr.com/register/, verify the email, then open https://console.vultr.com/billing/?promo=HACKATHON, enter the gift code, and click Apply Gift Code.
- The page says the gift code is shared at kickoff. The promo parameter on the official billing link is HACKATHON. Try that value first and confirm the console shows $200.00 Remaining Credit. If it is rejected, the kickoff code is still unverified.
- Stated uses: Vultr Compute Instances, Managed Databases, Kubernetes clusters, and other Vultr services during the hackathon.
- Credits and account access stay active throughout the event. Keeping deployments afterwards requires a payment method in Billing.
- Vultr GPUs are not available for this event.
- Whether the $200 pays for Serverless Inference: UNVERIFIED. Check the Usage tab after the credit is applied.
- Walkthrough video linked from the page: https://del1.vultrobjects.com/tech-talk/redeem-vultr-credits-for-hackathons.mp4

## 11. Differences from the operator brief

- Brief: "official deadline To be announced". Event page: the schedule is "To be announced" and no submission deadline appears. Broadly consistent; the deadline remains unverified.
- Brief: required "slides, cover image, video". Confirmed on EVENT. The brief did not mention the MIT-compliant / open-source requirement; it is a stated rule (EVENT, TOS s16).
- Brief did not mention: age 18+ and sanctions limits (TOS), prize payout tax and paperwork (TOS s17), Discord connection requirement (START), submit permissions (admin plus up to three teammates), Challenge 2 "no Vultr GPUs".
- Brief: Challenge 2 "enterprise workflow platform with a Vultr VM backend". EVENT adds that the app must be publicly accessible by browser, and lists focus areas.
- Brief: Challenge 1 "sandboxed containment-first agent" also requires a Vultr VM backend and web app on Vultr, plus an isolated sandbox. Brief omitted these.
- Remote entry winning: the brief marks it unverified; confirmed still unverified.
- No contradictions found on dates, team size 1-6, $200 credits, or the two challenge names.

## 12. Vultr Serverless Inference: technical notes

All from Vultr docs unless marked.

Subscription and keys
- Provision: Console Products > Serverless > Inference > Add Serverless Inference, enter a label, acknowledge the supported-models list and a charges note. API: `POST https://api.vultr.com/v2/inference` with JSON `label`. CLI: `vultr-cli inference create --label <name>`. (https://docs.vultr.com/products/compute/serverless-inference/provisioning.md)
- Management API base URL: `https://api.vultr.com/v2`; list `GET /inference`, get `GET /inference/{inference-id}` (returns the subscription's API key). Management auth: `Authorization: Bearer ${VULTR_API_KEY}` (the account API key). (https://docs.vultr.com/products/compute/serverless-inference/management/connection.md)
- Inference API key: Console Products > Serverless > Inference > subscription overview > API Key; or via the Get endpoint; or `vultr-cli inference get <inference-id>`. (same connection.md page)
- The chat docs state the inference key is the subscription's key, not the main Vultr API key. (https://docs.vultr.com/products/compute/serverless-inference/management/usage/chat.md)
- A search-result snippet suggested another Vultr guide (RAG) uses `${VULTR_API_KEY}` against the inference host. Not opened, so UNVERIFIED; follow the chat docs (subscription key) and test.

Inference API
- Base URL: `https://api.vultrinference.com/v1` (chat guide above).
- Chat: `POST https://api.vultrinference.com/v1/chat/completions`, headers `Authorization: Bearer ${INFERENCE_API_KEY}` and `Content-Type: application/json`. Body: `{"model": "{model-id}", "messages": [{"role":"user","content":"..."}], "max_tokens": 512}`. (chat.md)
- Models: `GET https://api.vultrinference.com/v1/models` with the inference key (seen in search result for the chat guide; the model-list page itself was not opened separately). The FAQ says the current list is in the Console, Prompt tab model selector. (https://docs.vultr.com/products/compute/serverless-inference/faq.md)
- FAQ describes a drop-in swap: replace your current inference API URL (such as OpenAI's) with Vultr's and authenticate with your Vultr key. The docs do not state "OpenAI-compatible" outright; the body and path shape are OpenAI-style. Verify by test.
- Tool calling: `tool_choice` accepts "none", "auto" (default), "required"; Vultr says tool calling is "currently supported only on the `kimi-k2-instruct` model". Tool call message shape follows OpenAI `tool_calls`. (https://docs.vultr.com/how-to-use-tool-calling-with-vultr-serverless-inference and chat.md)
- Overview: chat, prompt and speech endpoints plus RAG collections / vector store. (https://docs.vultr.com/products/compute/serverless-inference)
- Streaming, rate limits, full response schema: UNVERIFIED (not on pages opened; FAQ lists no limits).

Models
- Only `kimi-k2-instruct` is confirmed by name from opened Vultr pages. The FAQ describes a catalog covering large language, chat, code generation, text-to-speech and image generation models. Full current list: UNVERIFIED; get it from `/v1/models` with a key. Third-party estimator pages (not official, not opened in full) mention GLM-5 and MiniMax-M3 variants; do not rely on them.

Pricing and credits
- FAQ: costs appear in the Usage tab (token usage, overage, costs). No prices in opened Vultr pages. (faq.md)
- A search summary cited a 50 million token subscription allocation with overage of $0.0002 per 1,000 tokens from a Vultr page that was not opened. UNVERIFIED.
- Whether the $200 event credit pays for Serverless Inference: UNVERIFIED. General pricing page https://www.vultr.com/pricing/ not opened.
- GPUs are not available for this event (EVENT), which concerns GPU instances, not the inference API; whether it limits inference is UNVERIFIED.

## 13. Pages not opened

- https://www.vultr.com/pricing/ (inference pricing)
- Vultr chat-completion API reference (full response schema)
- Any Discord announcements, kickoff materials (may hold the real deadline, judging weights, and credit-code instructions)
