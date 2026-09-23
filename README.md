# Prudentia ⚖️

> **The definitive offer letter analyser that grounds every risk flag in actual Indian law—and simulates what happens if a clause gets triggered.**

[![Model: Gemini 2.5 Flash](https://img.shields.io/badge/Model-Gemini_2.5_Flash-8A2BE2?style=flat-square&logo=googlegemini)](https://ai.google.dev/)
[![Stack: React + Vite](https://img.shields.io/badge/Stack-React_19_|_Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Architecture: Serverless](https://img.shields.io/badge/Architecture-Vercel_Serverless-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Size](https://img.shields.io/badge/Repo_Size-<500KB-success?style=flat-square)](#)

Built for **PromptWars: Virtual (Exclusive Edition) — Hack2Skill**  
**Problem Statement:** AI for Legal Assistance & Access

---

## 📖 The Vision: What is Prudentia?

For an Indian engineering student in placement season, receiving an offer letter is a defining moment. However, these documents are often loaded with complex legalese—predatory bonds, aggressive non-competes, and ambiguous notice periods. 

The student has no fast, reliable way to know if a clause is legally enforceable or standard market practice before the tight signing deadline passes. They cannot afford a lawyer on retainer. 

**Prudentia** bridges this massive information asymmetry. It transforms dense contracts into clear, actionable, and legally-grounded insights.

---

## 🎯 Why We Win (Competitive Analysis)

**The one-sentence differentiator:** Contextualis verifies against the document. Fenco verifies against generic benchmark clauses. LegalLens verifies against nothing (keyword templates). **Prudentia is the only one that verifies against actual, citable Indian law.**

Against the top competitor submissions, specifically:

*   **Contextualis** — strong, honest document-verification engine, genuinely well-built. But "verified" never means "legally sound," only "the quote exists." We do what they do *plus* real statute citations, which their architecture has no path to.
*   **Fenco** — two-tier scoring against 32 seeded clauses covering exactly two document types, zero employment/offer-letter coverage. Feed it a bond clause, it silently defaults to a meaningless risk tier. Our matching is domain-correct for the one persona we target, with no silent-failure mode.
*   **LegalLens** — headline "analysis" is keyword regex with hardcoded template output; lawyer-prep questions are 4 static strings regardless of document. Our `consultation_questions` are generated fresh from real per-document findings — structural win, not cosmetic.

**Universal gap all three share, that we close:** None cite real law. None have a consequence/what-if simulator. Confirmed multiple times across code-level review.

---

## 🧠 Why Prudentia beats a generic ChatGPT / Claude prompt

A generic AI assistant can summarise a pasted contract, but it critically fails in legal contexts:

1. **Hallucinates Legal Facts:** It will guess enforceability based on its training data. Prudentia **injects actual Indian statute text** (Indian Contract Act 1872, Specific Relief Act 1963, etc.) deterministically before the AI processes the document. 
2. **Inconsistent Confidence:** Generic AI wavers on retry. In Prudentia, `clause_to_statute_matcher.ts` maps every clause type to a specific statute key—guaranteeing stable legal grounding.
3. **Reactive vs. Proactive:** You must know what to ask ChatGPT. Prudentia proactively scans for and flags 5 highly-consequential employment clauses automatically.
4. **No Consequence Simulator:** Generic AI stops at a summary. Prudentia generates `consequence_scenarios` with `outcome_likelihood`—a "what-if simulator" predicting how Indian courts actually handle these disputes.

---

## 🏗️ Architecture & Decision Making

The system is designed with a **Zero-Footprint Ephemeral Architecture** prioritizing absolute data privacy and blazing-fast execution.

### The Pipeline
1. **Upload:** User drops a PDF.
2. **Native Vision:** The PDF is sent directly to Gemini 2.5 Flash as a `File` part. **No OCR or text extraction preprocessing** is needed, eliminating formatting corruption.
3. **Deterministic Grounding:** `clause_to_statute_matcher.ts` fetches verbatim Indian law and injects it into the system prompt.
4. **Validation:** The AI output is strictly validated against a JSON schema via Ajv. If it fails, a self-correcting prompt is automatically dispatched.
5. **Fuzzy Quote Verification:** `document_quote_verifier.ts` runs a Levenshtein distance check client-side to ensure the AI did not hallucinate the extracted clause quote.

### Architectural Constraints Met
- **No Database:** No Postgres, no Redis, no vector DBs. The document is held purely in serverless memory for one Vercel function invocation.
- **Repository Size:** Achieved a highly optimized footprint of ~431 KB, massively under the 10 MB hackathon limit.

---

## 📊 Results & Structured Outputs (PS Coverage)

| PS Requirement | Our Implementation |
|---|---|
| **Simplify complex documents** | Plain-language clause breakdown (`plain_english` field) |
| **Compare contracts** | Numeric clause values dynamically compared against `typical_clause_range_reference` |
| **Highlight risks** | `concern_level` risk flags strictly grounded in real statute text (`applicable_law`) |
| **Answer questions** | Grounded keyword Q&A with an explicit, honest `not_addressed_in_document` UI state |
| **Understand next steps** | `consequence_scenarios` (what-if simulator) per clause |
| **Prepare for a professional** | Export-ready consultation brief via `lawyer_consultation_export_builder.ts` |

### "Assist, Not Replace" Core Philosophy
This is not a disclaimer footer. It is enforced architecturally:
- **No legal conclusions stated as fact.** Risk flags use calibrated language: *"may be"*, *"commonly disputed"*.
- The `disclaimer` field is **required** in the JSON schema. If the LLM omits it, Ajv rejects the entire response.

---

## 🚀 Quick Start & How to Use

### Prerequisites
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) (Free tier is perfectly sufficient)

### Setup Instructions

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/prudentia.git
cd prudentia

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and insert: GEMINI_API_KEY=your_actual_key

# 4. Start the application
npm run dev
```

The app will launch at `http://localhost:5173`.

### Running Tests
Our test suite validates the deterministic logic, schema validators, and fuzzy-matching quote verification.
```bash
npm test
npm run test:coverage
```

---

## ⚖️ Statutes Referenced

| Key | Act | Section | Topic |
|---|---|---|---|
| `ICA_SEC_27` | Indian Contract Act, 1872 | 27 | Agreements in restraint of trade (non-compete, bond) |
| `ICA_SEC_73` | Indian Contract Act, 1872 | 73 | Compensation for breach (reasonable loss, not full penalty) |
| `ICA_SEC_74` | Indian Contract Act, 1872 | 74 | Liquidated damages—court assesses reasonableness |
| `ICA_SEC_23` | Indian Contract Act, 1872 | 23 | Unlawful consideration / public policy |
| `SRA_SEC_41` | Specific Relief Act, 1963 | 41 | Cannot compel personal service contracts |
| `IE_SEC_3` | Industrial Employment Act, 1946 | 3 | Standing orders / notice period context |
| `CA_SEC_17` | Copyright Act, 1957 | 17 | Employer IP ownership for work done during employment |
| `PA_SEC_6` | Patents Act, 1970 | 6 | Patent application rights |

