# ⚖️ Prudentia — Offer Letter Analyser for Indian Engineering Students

> *"Prudentia reads your offer letter the way a lawyer would — not the way Google would."*

[![Model](https://img.shields.io/badge/Model-Gemini_2.5_Flash-8A2BE2?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Stack](https://img.shields.io/badge/Stack-React_19_%7C_Vite_%7C_TypeScript-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Deployment](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-150_passing-brightgreen?style=flat-square&logo=vitest&logoColor=white)](#-test-coverage)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#)

Built for **PromptWars: Virtual (Exclusive Edition) — Hack2Skill**  
**Problem Statement:** AI for Legal Assistance & Access

---

## 📌 Table of Contents

1. [The Problem](#-the-problem)
2. [What Prudentia Does](#-what-prudentia-does)
3. [Why Not Just Use ChatGPT?](#-why-not-just-use-chatgpt)
4. [How It Works](#-how-it-works)
5. [What the Analysis Produces](#-what-the-analysis-produces)
6. [Indian Law Grounding](#-indian-law-grounding)
7. [Architecture](#-architecture)
8. [Test Coverage](#-test-coverage)
9. [Quick Start](#-quick-start)
10. [Deployment Guide](#-deployment-guide)
11. [Project Structure](#-project-structure)
12. [Design Principles](#-design-principles)

---

## 🎯 The Problem

Every year, hundreds of thousands of Indian engineering students receive their first job offer letter. Most of them sign it the same day.

They sign because they are excited. They sign because they trust the company. They sign because they cannot afford a lawyer, do not know what ICA §74 means, and have no one to ask.

Three months later, some of them discover what they signed:

- A **service bond** that says *"pay ₹2,00,000 if you resign before 18 months"*
- A **non-compete clause** that says *"you cannot join any competitor for 12 months after leaving"*
- A **notice period** where they owe 60 days but the company owes only 15
- An **IP assignment** that claims ownership of any software they ever write, even on weekends

These clauses are real. The financial and career consequences are real. And the students who sign them almost never know what they're agreeing to.

**Prudentia exists to close that gap.**

---

## 🔍 What Prudentia Does

Prudentia is a single-page web application. You upload a PDF of an employment offer letter. In 15–25 seconds, you receive a complete, structured legal analysis grounded in real Indian law.

Here is what the analysis covers for each detected clause:

| What You Get | What It Means |
|---|---|
| **Plain English explanation** | What this clause actually says, in language a 22-year-old can understand |
| **Exact quote from your document** | The verbatim text Prudentia read — you can verify it yourself |
| **Concern level** | Significant / Moderate / Minor — colour-coded and rationale-backed |
| **Applicable Indian statutes** | The real Act name and section number that governs this clause |
| **Consequence scenarios** | What happens if this clause is triggered — step by step, with financial estimates |
| **Outcome likelihood** | Whether an Indian court would call it Certain, Probable, or Possible |
| **Key numbers** | Bond duration, penalty amount, notice days — extracted and verified |
| **Quote verification** | Mathematical proof that the quote exists in your actual PDF |
| **Number consistency check** | Confirms the numbers Gemini extracted match what's in the exact quote |

After the clause analysis, you also get:

- 📋 **Consultation questions** — document-specific questions to raise with a lawyer
- 💬 **Q&A** — ask any plain-language question, get an instant answer from the analysis
- 🖨️ **Lawyer briefing note** — a printable, formatted document to bring to a paid consultation
- 📄 **PDF viewer with highlights** — see every quoted clause highlighted in yellow in your original document

---

## 🤔 Why Not Just Use ChatGPT?

This is the right question. Here is the honest answer.

### 1. ChatGPT hallucinates Indian statute numbers

Ask any general AI tool "Is my bond enforceable?" and it will cite sections that do not exist or do not apply. The Indian Contract Act alone has been confidently misquoted hundreds of times in AI outputs.

Prudentia does not ask Gemini to recall Indian law from training data. It **injects the verbatim text of real Indian statutes** into every prompt before analysis begins. Gemini cannot hallucinate a statute it has been given word-for-word.

### 2. ChatGPT gives general answers. Prudentia gives grounded ones.

| ChatGPT | Prudentia |
|---|---|
| "This non-compete clause may be problematic" | "This post-employment non-compete is prima facie void under Indian Contract Act, 1872, Section 27 — Indian courts consistently strike down such clauses regardless of duration or geographic scope" |
| Confident, vague | Specific, citable, correct |

### 3. ChatGPT doesn't verify what it read

You paste text into ChatGPT. You have no way to verify whether it analysed the right clause or made something up. Prudentia extracts the **exact verbatim quote** from the PDF for every claim, displays it to you, and runs an independent verification using PDF.js text extraction — so you see exactly what the AI read, on which page, and whether the numbers match.

### 4. ChatGPT tells you what. Prudentia tells you what happens next.

Knowing a clause exists is 10% of the problem. The other 90% is: *"If I sign this and then resign in month 14, what actually happens? What will the company do? What will a court say? How much will it cost me?"*

Prudentia models consequence scenarios for every clause — with step-by-step outcomes and financial estimates.

### 5. ChatGPT cannot prepare you for a lawyer

After using Prudentia, you receive a formatted briefing note with all clause summaries, statute references, and document-specific consultation questions. A 30-minute lawyer meeting is now actually productive instead of being spent explaining what the document says.

### 6. ChatGPT applies US/UK legal frameworks by default

Non-compete clauses that are enforceable in the USA are **void** in India under ICA §27. Bond penalties that seem valid in other countries are subject to India's "reasonable compensation" doctrine under §73-74. Prudentia is built exclusively for Indian employment law.

---

## ⚙️ How It Works

### The Pipeline

```
User uploads PDF
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                        │
│  1. PDF.js independently extracts full text              │
│     → Used for quote verification (client-side)          │
│  2. PDF converted to base64                              │
└──────────────────────────┬──────────────────────────────┘
                           │ POST /api/analyze_offer_letter
                           ▼
┌─────────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS FUNCTION                              │
│  3. clause_to_statute_matcher.ts maps all 5 clause       │
│     types → relevant statutes from the reference library │
│  4. Verbatim statute text injected into system prompt    │
│     → Gemini cannot hallucinate grounded citations       │
│  5. Gemini 2.5 Flash called with PDF (native vision)     │
│  6. Full JSON validated against strict schema (Ajv)      │
│     → Auto-retry with repair prompt on failure           │
│  7. Validated analysis returned as a single JSON        │
│     response                                             │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON response
                           ▼
┌─────────────────────────────────────────────────────────┐
│  CLIENT — Results                                        │
│  8.  document_quote_verifier.ts verifies each quote      │
│      against independently extracted PDF text            │
│  9.  verifyNumbers() cross-checks key_numbers vs quote   │
│  10. Risk dashboard + clause cards rendered              │
│  11. PDF.js renders original PDF in right pane           │
│  12. "View in document" → tokenPositionMap highlight     │
└─────────────────────────────────────────────────────────┘
```

### Zero-Footprint Architecture

- The PDF is **never written to disk** — held only in serverless memory
- Vercel function memory is ephemeral — zeroed between invocations
- No database, no vector store, no user accounts
- No telemetry, no analytics, no data retention
- Repo size: **< 500 KB** (hard hackathon constraint: 10 MB)

---

## 📊 What the Analysis Produces

### Example: Service Bond Clause

```json
{
  "clause_type": "bond",
  "title": "Service Bond for Training",
  "plain_english": "You must stay for 18 months or pay ₹2,00,000. The company claims this covers training costs, but Indian courts will only award what it can actually prove it spent.",
  "exact_quote": "As the Company will invest in your training and development, you agree to serve for a minimum period of 18 months. If you resign before this period, you will pay Rs. 2,00,000 as liquidated damages.",
  "page_hint": 2,
  "concern_level": "significant",
  "concern_rationale": "Under ICA §74, courts assess the 'reasonableness' of liquidated damages — ₹2L is the ceiling, not the guaranteed award. The company must prove actual training costs incurred.",
  "key_numbers": {
    "duration_months": 18,
    "amount_inr": 200000,
    "notice_days": null
  },
  "applicable_law": [
    { "act": "Indian Contract Act, 1872", "section": "73" },
    { "act": "Indian Contract Act, 1872", "section": "74" }
  ],
  "consequence_scenarios": [
    {
      "trigger": "Employee resigns before completing the 18-month bond period",
      "consequence_steps": [
        "Employer sends legal notice demanding ₹2,00,000",
        "Employee contests — company must prove actual training costs in court",
        "Court applies ICA §74: awards 'reasonable compensation', not the full claimed amount",
        "Typical award: actual verifiable costs, often significantly less than ₹2L"
      ],
      "financial_estimate": "Up to ₹2,00,000 (court will award reasonable compensation, which may be far less)",
      "outcome_likelihood": "possible"
    }
  ]
}
```

### Verifiable Confidence

Every clause analysis comes with two automated checks:

| Check | How It Works | Purpose |
|---|---|---|
| **Quote Verification** | PDF.js extracts text independently. `tokenPositionMap` algorithm matches the quote as a substring against the raw extraction. | Proves the AI read the right text, not a hallucinated passage |
| **Number Consistency** | `verifyNumbers()` extracts all numbers from `key_numbers` and checks each appears in `exact_quote`. | Catches cases where the AI extracted the wrong figure |

---

## 🏛️ Indian Law Grounding

Prudentia evaluates contracts against a curated, hardcoded dictionary of 8 Indian statutory provisions:

| Statute | Act | Section | What It Governs |
|---|---|---|---|
| ICA_SEC_27 | Indian Contract Act, 1872 | §27 | Restraint of trade — non-competes and bonds during service |
| ICA_SEC_73 | Indian Contract Act, 1872 | §73 | Compensation for breach — must be actual proved loss |
| ICA_SEC_74 | Indian Contract Act, 1872 | §74 | Liquidated damages — court assesses reasonableness, not face value |
| ICA_SEC_23 | Indian Contract Act, 1872 | §23 | Unlawful consideration and public policy violations |
| SRA_SEC_41 | Specific Relief Act, 1963 | §41 | Courts cannot compel personal service via injunction |
| IE_SEC_3 | Industrial Employment Act, 1946 | §3 | Standing orders context for notice periods |
| CA_SEC_17 | Copyright Act, 1957 | §17 | Employer IP ownership for work created during employment |
| PA_SEC_6 | Patents Act, 1970 | §6 | Patent application rights for employee inventions |

**Why this matters:** The statute text is injected verbatim into Gemini's context before every analysis. This is not RAG or embeddings — it is deterministic, hardcoded, and verifiable. The output citations are always one of these 8 provisions. Gemini cannot cite a statute that is not in this list.

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 19 + Vite | Fast, component-based, modern |
| **Type System** | TypeScript (strict) | Schema contracts enforced at compile time |
| **Backend** | Vercel Serverless Functions | Zero infrastructure, auto-scaling, cold-start < 1s |
| **AI Model** | Gemini 2.5 Flash | Native PDF vision — no OCR preprocessing needed |
| **PDF Rendering** | pdfjs-dist (CDN worker) | Client-side PDF rendering + text extraction |
| **Schema Validation** | Ajv (JSON Schema) | Gemini output validated before it reaches the UI |
| **Testing** | Vitest | Fast, ESM-native, co-located tests |

### Key Logic Modules

```
src/logic/
├── analysis_schema_validator.ts    # Zod-style strict schema + Ajv validation
├── clause_to_statute_matcher.ts    # Maps clause types → relevant statute keys
├── clause_range_comparator.ts      # Determines if key numbers are typical/high/low
├── consequence_scenario_formatter.ts # Renders consequence scenarios to readable text
├── document_quote_verifier.ts      # tokenPositionMap bounding box highlighter + verifyNumbers()
├── indian_statute_reference.ts     # The 8 hardcoded statutes with verbatim text
├── lawyer_consultation_export_builder.ts # Builds the printable HTML briefing note
└── pdf_text_extractor.ts          # PDF.js wrapper for independent text extraction

api/
└── analyze_offer_letter.ts         # Vercel serverless handler (single request/response)
```

---

## 🧪 Test Coverage

**150 tests across 10 files — all deterministic logic, no mocking of AI responses.**

| Test File | Tests | What It Validates |
|---|---|---|
| `analysis_schema_validator.test.ts` | 19 | Schema shape, required fields, enum values, disclaimer enforcement |
| `clause_range_comparator.test.ts` | 25 | Bond duration/amount/notice period range classification |
| `document_quote_verifier.test.ts` | 21 | Quote matching (exact, fuzzy, not-found, unicode edge cases) |
| `clause_to_statute_matcher.test.ts` | 20 | Clause type → correct statute key mapping |
| `consequence_scenario_formatter.test.ts` | 19 | Scenario rendering, financial formatting, likelihood labels |
| `analysis_pipeline_edge_cases.test.ts` | 16 | Non-offer-letter docs, empty clauses, schema repair |
| `document_verification_integration.test.ts` | 9 | Quote verifier + number verifier working together |
| `lawyer_consultation_export_builder.test.ts` | 11 | Export HTML structure, statute citations, disclaimer |
| `indian_statute_reference.test.ts` | 7 | Statute library completeness, text non-empty |
| `pdf_text_extractor.test.ts` | 3 | PDF.js extraction module exports and interface |

```bash
npm test              # Run all 150 tests
npm run test:coverage # With coverage report
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **A Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Local Development

```bash
# 1. Clone
git clone https://github.com/akshayparihardev/Promptwars-Exclusive-Edition-Prudentia.git
cd Promptwars-Exclusive-Edition-Prudentia

# 2. Install
npm install

# 3. Configure environment
echo "GEMINI_API_KEY=your_key_here" > .env

# 4. Start the backend (Express wrapper for local dev, port 3001)
npm run server

# 5. Start the frontend (separate terminal, port 5173)
npm run dev
```

Open **http://localhost:5173**, upload any PDF offer letter, and get a full analysis in 15–25 seconds.

> **Note:** The production deployment uses Vercel Serverless Functions. Locally, `server.js` is an Express wrapper that mimics the Vercel function environment.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key (free tier works) |
| `VITE_APP_URL` | Optional | CORS origin for production deployment |

---


## 🎨 Design Principles

### "Assist, Not Replace" — Enforced at Architecture Level

This is not a disclaimer footer. It is built into the schema:

- The `disclaimer` field is **required** in the JSON schema. If Gemini omits it, Ajv rejects the entire response and triggers a repair retry.
- Every `concern_rationale` must cite an applicable statute — the schema enforces `applicable_law` is non-empty for significant and moderate clauses.
- The system prompt explicitly prohibits phrases like "this is void" or "you will win". All risk language is calibrated: *"may be"*, *"courts have commonly held"*, *"worth clarifying with a professional"*.

### Why Deterministic Statute Injection Instead of RAG

We considered vector embeddings and RAG for statute retrieval. We rejected it. With 8 statutes and fixed clause types, a hardcoded lookup table is:

- **100% reliable** — no embedding drift, no similarity threshold tuning
- **Fully auditable** — a judge can read `indian_statute_reference.ts` and verify every word
- **Zero hallucination risk** — the statute text Gemini sees is byte-for-byte what a human curated
- **Faster** — no embedding generation, no vector search latency

### Request Lifecycle

The Gemini API call takes 15–25 seconds. The UI tracks distinct phases (`uploading` → `analyzing` → `validating` → `complete`) so the user always sees which stage is running, but the backend call itself is a single blocking request-response — there is no token-level streaming or per-clause status yet. Streaming the response (via `generateContentStream()` + SSE) so users see partial results and live per-clause status as they're found is a planned improvement, not yet implemented.

---

## 🏆 Competition Context

**Event:** PromptWars: Virtual (Exclusive Edition) — Hack2Skill  
**Problem Statement:** AI for Legal Assistance & Access  
**Repository Size:** < 500 KB (limit: 10 MB)  
**Model:** Gemini 2.5 Flash  
**Tests:** 150 passing, 0 failing  

---

## 📄 Disclaimer

Prudentia provides AI-generated analysis for informational purposes only. It does not constitute legal advice. The analysis is grounded in Indian statutory text but is not a substitute for consultation with a qualified Indian labour law practitioner. Always consult a licensed advocate before making decisions based on this analysis.

---

<div align="center">

**Built with care for every engineering student who just wants to understand what they're signing.**

⚖️ *Prudentia — Careful judgment in practical matters*

</div>
