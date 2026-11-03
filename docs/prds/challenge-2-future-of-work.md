# PRD: Challenge 2, Powering the Future of Work (NOT CHOSEN; fallback)

Rules: docs/competition.md s3. Requirements: Vultr VM backend and web deployment; publicly reachable in a browser; Serverless Inference optional; no Vultr GPUs; focus areas sales ops, finance, HR, customer support, procurement.

Working title (placeholder): Three-Way Match.

## User

An accounts-payable or procurement clerk at a small company who receives supplier invoices, purchase orders and delivery notes as separate documents. No customer is named or claimed.

## Job to be done

"Tell me whether this invoice matches its purchase order and delivery note, and what to query with the supplier if not."

## Product concept

A web app on a Vultr VM. The user uploads an invoice, a purchase order and a delivery note (text-based PDFs or CSV). The backend extracts line items, runs deterministic matching (quantity, unit price, totals, tax, duplicates) and produces an exceptions list with a draft supplier query. Matching arithmetic is code, not model output. Serverless Inference (optional) would handle messy field extraction and drafting the supplier message.

## Partner capability that does the work

Vultr Cloud Compute hosts everything. Inference is optional and, in this design, only an extraction and drafting aid, which is the shallow Vultr use that led to rejecting this track. Making inference central (agent that decides which checks to run via tool calling on kimi-k2-instruct) is possible but moves the entry into a crowded "workflow agent" lane.

## Demo must show, on real input

Real sample documents created for the demo (synthetic, labelled as such, committed to the repo). Upload three documents on the live URL; show extracted lines, a mismatch caught by the deterministic matcher (for example a quantity short-delivered), and the draft supplier query. Totals verifiable by hand. Scanned/image PDFs are out of scope unless OCR is added, and the UI says so.

## When the inference key is absent

Fully functional: extraction is rule-based for the supported templates, and drafting uses a fixed template. The UI states "Drafting by template, no LLM". This is a genuine reduced mode, not a mock of the same feature, but it must still be labelled so. If inference is used, the UI says which model and the label is removed only when `healthz` shows live.

## Who pays

Hypothesis only: small finance teams that match documents by hand. No price or market size is claimed.

## What would make a judge call it a wrapper

- A document upload that sends text to a model and prints its reply.
- Matching done by the model rather than code, with no way to check.
- Vultr used only as hosting, with the app indistinguishable from one on any other host.
- Synthetic data presented as customer data.

## Why not chosen

Optional inference leaves little Vultr-specific depth; the area is crowded; broad focus areas invite a wide, thin build. Retained as the fallback if the inference key cannot be obtained (trigger R1 in docs/win-plan.md). Switching is Alex's decision, and it must not be dressed up as Challenge 1 compliance.
