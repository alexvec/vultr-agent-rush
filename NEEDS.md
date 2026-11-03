# NEEDS

## Blocker checked 2026-11-03, rebuild run

The one connected Chrome is not signed in to Vultr: console.vultr.com/billing/ shows the login page. No Vultr session, inference key or API key is available to this run, so the balance could not be read and nothing was provisioned. HACKATHON was not applied and no card was linked. The agent does not type passwords on production services, and did not use Google or GitHub sign-in, which could grant OAuth access or create a second account.

Exact step for Alex, either one:
- Sign in to console.vultr.com in the Chrome that has the Claude extension, then resume. The agent reads the balance and tries provisioning. Or:
- Create the inference subscription, an Ubuntu 24.04 VM and an API key, and put `VULTR_INFERENCE_API_KEY=...` and the VM address in `.env`, then resume.

## Rebuild order (2026-11-03, supersedes every later line that tells the operator to register or redeem a code)

The operator ordered a rebuild. Keep Challenge 1. The Vercel preview is not the demo. The Vultr account already exists and is signed in at console.vultr.com. The gift code has not been shared yet. Do not apply HACKATHON again. Do not link a credit card. Check the billing balance, create Serverless Inference and a VM if the account can provision without a card, and make the sandbox execute for real. If provisioning refuses for lack of credit, record that single fact and keep the local sandbox real. Do not switch to a chat demo. Do not submit. Stop only for a captcha, a payment card, government ID, or a tax form.

The agent creates the accounts and keys below. Alex steps in only for a payment card, government ID, a tax form, or a code he must type himself. Do not submit the entry.

| # | What | Why | Stage blocked | Build can proceed without it? |
|---|---|---|---|---|
| 1 | Done. Alex registered on lablab.ai for Vultr Agent Rush on 2026-11-03. Do not register again. Use the operator avatar file if the profile or cover image is his. | Required to participate and to submit (START, EVENT) | Submission; also team creation | Yes |
| 2 | The agent connects Discord to the lablab.ai profile and joins the lablab.ai Discord server, if the signed-in session can. | Required for the event community (START) | Submission | Yes for the build |
| 3 | Done. Team Windboy created 2026-11-03 at https://lablab.ai/ai-hackathons/vultr-hackathon/windboy. Alex Veciana (alexvec) is the only member and the admin. Membership is closed. Do not submit the project. Cover image was not uploaded. | Only the admin and up to three chosen teammates can submit | Submission | Yes |
| 4 | The agent creates a Vultr account with the operator email, if that email is not already on a Vultr account. | Needed for the VM, the web app, and Serverless Inference | Deploy and the live demo | The agent tries before any mock fallback |
| 5 | The agent redeems the $200 credit at https://console.vultr.com/billing/?promo=HACKATHON before any payment card. Try code HACKATHON first. Confirm $200.00 Remaining Credit. If rejected, use the kickoff code from the event page, email, or Discord. | Funds Compute and other Vultr services during the event. Inference coverage is UNVERIFIED. GPUs are excluded. | Deploy | No. Redeem this before a mock deploy or a payment card |
| 6 | Alex adds a payment method only if Vultr will not provision without one. | Keeping deployments after the event credit may require it. UNVERIFIED | Deploy after the credit | Yes until a provision call refuses for lack of payment |
| 7 | The agent provisions Serverless Inference and writes the inference key and the account API key to `.env`. | Challenge 1 requires Serverless Inference | The real inference path | The agent tries before a labelled mock |
| 8 | Confirm whether the $200 credit covers Serverless Inference usage (Usage tab, or Vultr pricing page) | Not stated in Vultr docs opened; if it is not covered, inference may be a paid-plan cost | Cost of Challenge 1 | Yes, but cost risk is unknown |
| 9 | Check the lablab.ai event page and Discord for the official submission deadline, judging weights, and any registration approval step | Deadline is not published on the event page (UNVERIFIED) | Planning and submit timing | Yes |
| 10 | Record the demo video and run submit.sh himself. The cover image is the avatar file above. | Authorisation rule: only the operator submits, uploads or posts | Submission | Not applicable |

Notes
- No third-party partner API keys are required by the event pages opened. Sandbox tools named (Docker, OpenSandbox, gVisor, E2B, Microsandbox) are examples only; E2B, if chosen, would need its own account and key, which is not required by the rules.
- Eligibility checks for Alex: 18 or older, and not resident in a US-sanctioned country (TOS). Prize payout needs ID, tax form and bank verification in his name; non-US winners face 30% US withholding unless a treaty applies (TOS s17).
- Travel is not covered, so Alex enters online. Whether a remote entry can win the main prizes is UNVERIFIED; consider asking the organizers on Discord (Alex's action, not the agent's).

## Found during the build (2026-11-03)

| # | What Alex must do | Why | Blocks |
|---|---|---|---|
| 11 | Look at Docker Desktop. Its engine VM stopped at 15:28:47 local time, after dockerd logged input/output errors writing to its disk and blob errors from its image store. The agent did not restart or repair it, because it holds containers from other projects. | The final code has not had a complete passing run with real Docker, so the build box stays unticked | Ticking build; local demo |
| 12 | Once Docker works: `npm run sandbox:build && npm test && npm run demo` | Finishes the check described in the README | Ticking build |
| 13 | Supply a VM and an inference key (items 4 to 7), then run `npm run smoke:inference` and `VULTR_INFERENCE_API_KEY=... deploy/deploy.sh root@<vm-ip>` | Neither has ever been run against Vultr | Challenge 1 compliance, live URL, video |
| 14 | Decide whether CLAUDE.md, AGENTS.md and the submit script should be public. The agent left them untracked. | They were not on the list of files to publish | Nothing |

## Exact remaining steps for Alex (revoked 2026-11-03)

None, until a captcha, a payment card, government ID, or a tax form appears. The account exists. The gift code is unpublished, so do not invent one and do not link a card. Final submission stays with Alex.

