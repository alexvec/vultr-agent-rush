# NEEDS

The agent creates the accounts and keys below. Alex steps in only for a payment card, government ID, a tax form, or a code he must type himself. Do not submit the entry.

| # | What | Why | Stage blocked | Build can proceed without it? |
|---|---|---|---|---|
| 1 | Done. Alex registered on lablab.ai for Vultr Agent Rush on 2026-11-03. Do not register again. Use `/Users/alex/Documents/GitHub/hackathon-ops/operator-assets/avatar.jpg` if the profile or cover image is his. | Required to participate and to submit (START, EVENT) | Submission; also team creation | Yes |
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
