# Prudentia — Architecture

## Overview

Prudentia is a single-page React application with a single Vercel serverless backend function. The architecture is deliberately minimal to satisfy the 10MB repository constraint and the "no storage, fully ephemeral" requirement.

```
Browser (React + Vite)
    │
    │  POST /api/analyze_offer_letter
    │  { pdf_base64, mime_type, language }
    ▼
Vercel Serverless Function
    │
    ├── Statute context injection (deterministic lookup)
    │     indian_statute_reference.ts → CLAUSE_TYPE_TO_STATUTE
    │
    ├── Gemini (native PDF vision, JSON output mode)
    │     Tries gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash
    │     in order, falling back on rate-limit/quota errors (each model has
    │     its own free-tier daily quota)
    │     Input:  PDF bytes + statute-enriched prompt
    │     Output: JSON matching OfferLetterAnalysis interface
    │
    └── Ajv schema validation
          analysis_schema_validator.ts
          → Returns validated OfferLetterAnalysis or HTTP 422
```

## Key Design Decisions

### 1. Statute injection is deterministic, not AI-decided

Before the Gemini call, `clause_to_statute_matcher.ts` maps known clause types to specific statute keys, and the full statute text + relevance notes from `indian_statute_reference.ts` are injected into the prompt. Gemini reasons from real law — not from its training-data approximation of that law.

This is the core architectural distinction from a "generic PDF Q&A chatbot": the legal grounding is pre-wired, not emergent.

### 2. Three-state quote verification (not two)

`document_quote_verifier.ts` produces exactly three states:

| State | Meaning |
|---|---|
| `confirmed_in_document` | Quote was found in the document |
| `not_found_in_document` | AI claims clause exists but quote is unverifiable — hallucination risk signal |
| `not_addressed_in_document` | Topic simply absent from document — this is meaningful, not an error |

`not_found` and `not_addressed` must NEVER be merged — they signal completely different situations.

### 3. No hardcoded document-type logic

The pipeline is:
```
extract clauses → match clause type to statute → assess risk → simulate consequence
```

"Offer letter" is not baked into the structure — the schema has `is_offer_letter` as a runtime flag, not a structural assumption. The same pipeline could analyse an NDA, a freelance contract, or a rental agreement by adding statute entries and clause types.

### 4. "Assist not replace" as enforced behavior

- The Gemini system prompt prohibits legal conclusions stated as fact (no "this is void," no "you will win")
- The `disclaimer` field is required in the JSON schema — if Gemini omits it, Ajv validation fails and the response is rejected
- `concern_rationale` must reference applicable law — bare opinion fails the prompt instruction
- `typical_clause_range_reference.ts` carries a `non_authoritative_label` on every entry, mandatory on every UI surface that displays a comparison

### 5. Zero persistence

The PDF is converted to base64 in the browser, sent in a POST body, held only in the serverless function's memory for the duration of one invocation, and then zeroed. No file system writes, no database, no object storage. Vercel function memory is ephemeral between cold starts.

## Data Flow

```
User uploads PDF
      │
      ▼
use_document_analysis.ts (hook)
  → FileReader.readAsDataURL → base64
  → PDF.js text extraction starts in parallel (awaited only when results arrive)
  → fetch('/api/analyze_offer_letter', { pdf_base64, mime_type, language })
      │
      ▼
api/analyze_offer_letter.ts (Vercel fn)
  → buildAnalysisPrompt() — injects statute context
  → GoogleGenerativeAI.generateContent([prompt, pdfPart])
  → JSON.parse(responseText) — strips markdown fences
  → validateAnalysisOutput() — Ajv strict validation
  → [if invalid] one retry with repair prompt
  → res.status(200).json(analysis)
      │
      ▼
AnalysisResultsView
  → OfferSummarySection
  → ClauseRiskCard (× n clauses)
      → StatuteCitationPanel (expandable)
      → ConsequenceScenarioPanel (expandable)
  → QAPanel (local, deterministic — no second AI call)
  → LawyerConsultationExportButton → printLawyerConsultationExport()
```

## Module Dependency Graph

```
api/analyze_offer_letter.ts
  ├── src/data/indian_statute_reference.ts     (statute texts)
  ├── src/logic/analysis_schema_validator.ts   (Ajv validation)
  └── src/logic/clause_to_statute_matcher.ts   (prompt injection)

src/components/analysis_results_view.tsx
  ├── src/components/clause_risk_card.tsx
  │     ├── src/logic/clause_range_comparator.ts
  │     ├── src/components/statute_citation_panel.tsx
  │     └── src/components/consequence_scenario_panel.tsx
  │           └── src/logic/consequence_scenario_formatter.ts
  └── src/components/lawyer_consultation_export_button.tsx
        └── src/logic/lawyer_consultation_export_builder.ts

src/hooks/use_document_analysis.ts
  └── src/logic/document_quote_verifier.ts
```

## Fresh Terminology Reference

| Concept | Term used in this codebase | Terms NOT used |
|---|---|---|
| Quote check result | `quote_status` | verified/unverified |
| Quote found | `confirmed_in_document` | verified, found |
| Quote missing | `not_found_in_document` | unverified, uncertain |
| Topic absent | `not_addressed_in_document` | not applicable |
| Risk level | `concern_level` | risk tier, severity |
| Risk values | `minor / moderate / significant` | Standard/Caution/Unfavorable |
| Statute link | `applicable_law` | sources, references |
| Scenario confidence | `outcome_likelihood` | probability, risk |
| Confidence values | `probable / possible / uncertain` | likely/unlikely/certain |

## Constraints Maintained

- Repository size: < 10MB (node_modules and dist are gitignored)
- No vector DB, no embeddings, no Docker
- No PDF storage — ephemeral session only
- No third-party CSS frameworks — vanilla CSS, custom design system in src/index.css
- Single serverless function — no microservices
- Max 3 submission attempts — do not deploy until confident in final state
