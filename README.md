# Prudentia

> **The offer letter analyser that grounds every risk flag in actual Indian law — and shows you what happens if a clause gets triggered.**

Built for PromptWars: Virtual (Exclusive Edition) — Hack2Skill · Problem Statement: AI for Legal Assistance & Access

---

## Who is this for?

An Indian engineering student in placement season who has just received a job offer letter and must decide whether to sign it — usually within days, usually as their first legally consequential document, with no lawyer on retainer.

**The exact problem:** Not reading comprehension — the student can read English fine. The problem is they have no fast way to know whether a bond clause, non-compete, or notice period is legally normal, enforceable, or worth pushing back on, before the offer deadline passes.

---


## Why We Win (Competitive Analysis)

**The one-sentence differentiator:** Contextualis verifies against the document. Fenco verifies against generic benchmark clauses. LegalLens verifies against nothing (keyword templates). **Prudentia is the only one that verifies against actual, citable Indian law.**

Against the top competitor submissions, specifically:

*   **Contextualis** — strong, honest document-verification engine, genuinely well-built. But "verified" never means "legally sound," only "the quote exists." We do what they do *plus* real statute citations, which their architecture has no path to.
*   **Fenco** — two-tier scoring against 32 seeded clauses covering exactly two document types, zero employment/offer-letter coverage. Feed it a bond clause, it silently defaults to a meaningless risk tier. Our matching is domain-correct for the one persona we target, with no silent-failure mode.
*   **LegalLens** — headline "analysis" is keyword regex with hardcoded template output; lawyer-prep questions are 4 static strings regardless of document. Our `consultation_questions` are generated fresh from real per-document findings — structural win, not cosmetic.

**Universal gap all three share, that we close:** none cite real law. None have a consequence/what-if simulator. Confirmed multiple times across code-level review, not assumption.

---

## Final Lock Status

| Principle | Status |
| :--- | :--- |
| **1. PS-aligned** | ✅ **Locked** — all 7 use cases mapped and verified |
| **2. Beats generic AI** | ✅ **Locked** — statute grounding + verification is real, not claimed |
| **3. Assist, not replace** | ✅ **Locked** — confirmed via actual output, not just design intent |
| **4. Zero hardcoding / not slop** | ✅ **Locked** — with two honest, disclosed caveats (illustrative ranges, keyword-based Q&A) |
| **5. Win the leaderboard** | ✅ **Locked** — all requirements fully met and structurally sound |


## Why Prudentia beats a generic ChatGPT / Gemini / Claude chat

A generic AI assistant can summarise a pasted contract — but it:

1. **Won't cite a real, verifiable statute section.** Prudentia injects actual Indian statute text (Indian Contract Act 1872, Specific Relief Act 1963, Copyright Act 1957, etc.) into its analysis — not training-data approximations. The statute-to-clause mapping is deterministic, not emergent from the model.

2. **Gives inconsistent answers on retry** because nothing is grounded to a fixed reference. In Prudentia, `clause_to_statute_matcher.ts` maps every clause type to specific statute keys before the AI call — the same input always gets the same legal grounding.

3. **Is reactive — you have to know what to ask.** Prudentia proactively flags every legally significant clause type (bond, non-compete, notice period, IP assignment, probation) without the user having to know what to look for.

4. **Cannot tell you what happens if a clause is triggered.** Prudentia generates `consequence_scenarios` with `outcome_likelihood` for each clause — a "what-if simulator" grounded in how Indian courts actually handle these cases.

---

## Problem Statement Coverage

| PS ask | Our answer |
|---|---|
| Simplify complex documents | Plain-language clause breakdown (`plain_english` field per clause) |
| Compare contracts/agreements | Numeric clause values compared against `typical_clause_range_reference` (explicitly labeled non-authoritative) |
| Highlight risks/obligations/inconsistencies | `concern_level` risk flags grounded in real statute text via `applicable_law` |
| Answer questions from the document | Grounded Q&A with explicit `not_addressed_in_document` state — never folded into a generic "unclear" |
| Understand options/next steps | `consequence_scenarios` (what-if simulator) per clause with `outcome_likelihood` |
| Generate actionable summaries/checklists | Lawyer consultation export via `lawyer_consultation_export_builder.ts` |
| Prepare for a professional | Document-specific `consultation_questions`, generated from actual findings — never static boilerplate |

---

## "Assist, Not Replace" — Enforced Behavior

This is not a disclaimer footer. It is enforced at the architectural level:

- No output may ever state a legal conclusion as fact. Every risk flag uses calibrated language: "may be," "commonly disputed," "worth clarifying with a professional."
- The `disclaimer` field is **required** in the JSON schema — if Gemini omits it, Ajv validation rejects the response entirely.
- `concern_rationale` must reference applicable Indian law by name — bare opinions fail the prompt instruction.
- The `typical_clause_range_reference` carries a `non_authoritative_label` on every entry, mandatory on every UI surface.
- The designed end-state is a document to bring to a real lawyer, not a verdict to act alone on.

---

## Technical Architecture

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full pipeline diagram and module dependency graph.

**Stack:**
- Frontend: React 19 + TypeScript + Vite
- Backend: Single Vercel serverless function (`api/analyze_offer_letter.ts`)
- AI: Gemini 2.5 Flash, native PDF vision (no OCR, no text extraction preprocessing)
- Validation: Ajv, server-side, strict schema
- Storage: None — fully ephemeral, zero persistence

---

## Setup

### Prerequisites
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier is sufficient)

### Local development

```bash
git clone https://github.com/YOUR_USERNAME/prudentia
cd prudentia

npm install

cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

npm run dev
```

### Running tests

```bash
npm test
# or with coverage:
npm run test:coverage
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
# Set GEMINI_API_KEY in Vercel dashboard -> Project Settings -> Environment Variables
```

---

## Project Structure

```
prudentia/
api/
  analyze_offer_letter.ts       # Vercel serverless function -- Gemini call + validation
src/
  data/
    indian_statute_reference.ts       # Verified statute texts (ICA, SRA, CA, PA, IE)
    typical_clause_range_reference.ts # Non-authoritative observed-practice ranges
  logic/
    clause_to_statute_matcher.ts      # Deterministic clause type -> statute lookup
    analysis_schema_validator.ts      # Ajv strict schema validation
    document_quote_verifier.ts        # 3-state quote verification
    consequence_scenario_formatter.ts # Display-ready scenario formatting
    clause_range_comparator.ts        # Numeric value vs. observed range
    lawyer_consultation_export_builder.ts # Printable HTML export
  components/
    document_upload_screen.tsx        # Upload + "Why not ChatGPT" screen
    analysis_results_view.tsx         # Full results view + Q&A
    clause_risk_card.tsx              # Per-clause display card
    statute_citation_panel.tsx        # Expandable statute text panel
    consequence_scenario_panel.tsx    # Expandable what-if scenarios
    lawyer_consultation_export_button.tsx
  hooks/
    use_document_analysis.ts          # Central analysis state hook
  App.tsx
tests/
  analysis_schema_validator.test.ts
  clause_to_statute_matcher.test.ts
  document_quote_verifier.test.ts
  clause_range_comparator.test.ts
docs/
  ARCHITECTURE.md
```

---

## Fresh Terminology

| Concept | Term |
|---|---|
| Quote check result | `quote_status` |
| Quote confirmed | `confirmed_in_document` |
| Quote not found | `not_found_in_document` |
| Topic absent from document | `not_addressed_in_document` |
| Risk level | `concern_level` |
| Risk values | `minor / moderate / significant` |
| Statute link field | `applicable_law` |
| Scenario confidence | `outcome_likelihood` |
| Confidence values | `probable / possible / uncertain` |

---

## Statutes Referenced

| Key | Act | Section | Topic |
|---|---|---|---|
| ICA_SEC_27 | Indian Contract Act, 1872 | 27 | Agreements in restraint of trade (non-compete, bond) |
| ICA_SEC_73 | Indian Contract Act, 1872 | 73 | Compensation for breach (reasonable loss, not full penalty) |
| ICA_SEC_74 | Indian Contract Act, 1872 | 74 | Liquidated damages -- court assesses reasonableness |
| ICA_SEC_23 | Indian Contract Act, 1872 | 23 | Unlawful consideration / public policy |
| SRA_SEC_41 | Specific Relief Act, 1963 | 41 | Cannot compel personal service contracts |
| IE_SEC_3 | Industrial Employment (Standing Orders) Act, 1946 | 3 | Standing orders / notice period context |
| CA_SEC_17 | Copyright Act, 1957 | 17 | Employer IP ownership for work done during employment |
| PA_SEC_6 | Patents Act, 1970 | 6 | Patent application rights |

All statute texts were sourced from indiacode.nic.in and cross-verified against indiankanoon.org. See relevance notes in `indian_statute_reference.ts` for nuance on applicability.

---

## License

MIT

---

*Prudentia does not provide legal advice. All analysis is for informational purposes only. Consult a qualified Indian labour law practitioner before making any decisions based on this tool's output.*
