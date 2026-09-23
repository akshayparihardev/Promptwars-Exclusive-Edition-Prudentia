import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

const offerLetterText = `
CONFIDENTIAL EMPLOYMENT OFFER
Date: 23 September 2026
To: Akshay Parihar

Dear Akshay,
We are pleased to offer you the position of Senior Software Engineer at TechCorp India Pvt Ltd. Your total CTC will be INR 24,00,000 per annum. Your expected date of joining is 15 October 2026.

1. PROBATION
You will be on probation for a period of 6 months. During this period, the company may terminate your employment by giving 15 days of notice or salary in lieu thereof.

2. NOTICE PERIOD
After confirmation, either party may terminate this agreement by providing 60 days of written notice.

3. COMMITMENT BOND
The company will invest significantly in your specialized training. Therefore, you agree to remain in the employment of the company for a minimum period of 18 months from your joining date. If you resign before this period, you shall be liable to pay the company a sum of INR 2,00,000 as liquidated damages to cover training costs.

4. NON-COMPETE
For a period of 12 months after leaving the company, you shall not join any direct competitor of TechCorp in the fintech space within India.

5. INTELLECTUAL PROPERTY
All intellectual property, code, and inventions created by you during your employment shall be the exclusive property of the company.

Please sign below to accept.
`;

const schemaString = `
{
  "type": "object",
  "properties": {
    "document_type": { "type": "string" },
    "is_offer_letter": { "type": "boolean" },
    "offer_summary": {
      "type": "object",
      "properties": {
        "company": { "type": ["string", "null"] },
        "role": { "type": ["string", "null"] },
        "ctc": { "type": ["string", "null"] },
        "joining_date": { "type": ["string", "null"] }
      },
      "required": ["company", "role", "ctc", "joining_date"],
      "additionalProperties": false
    },
    "clauses": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "clause_type": { "type": "string", "enum": ["bond", "non_compete", "notice_period", "probation", "ip_assignment", "general"] },
          "title": { "type": "string" },
          "plain_english": { "type": "string" },
          "exact_quote": { "type": "string" },
          "page_hint": { "type": ["number", "null"] },
          "concern_level": { "type": "string", "enum": ["minor", "moderate", "significant"] },
          "concern_rationale": { "type": "string" },
          "key_numbers": {
            "type": "object",
            "properties": {
              "duration_months": { "type": ["number", "null"] },
              "amount_inr": { "type": ["number", "null"] },
              "notice_days": { "type": ["number", "null"] }
            },
            "required": ["duration_months", "amount_inr", "notice_days"],
            "additionalProperties": false
          },
          "applicable_law": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "act": { "type": "string" },
                "section": { "type": "string" }
              },
              "required": ["act", "section"],
              "additionalProperties": false
            }
          },
          "consequence_scenarios": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "trigger": { "type": "string" },
                "consequence_steps": { "type": "array", "items": { "type": "string" } },
                "financial_estimate": { "type": ["string", "null"] },
                "outcome_likelihood": { "type": "string", "enum": ["probable", "possible", "uncertain"] }
              },
              "required": ["trigger", "consequence_steps", "financial_estimate", "outcome_likelihood"],
              "additionalProperties": false
            }
          }
        },
        "required": ["id", "clause_type", "title", "plain_english", "exact_quote", "page_hint", "concern_level", "concern_rationale", "key_numbers", "applicable_law", "consequence_scenarios"],
        "additionalProperties": false
      }
    },
    "consultation_questions": { "type": "array", "items": { "type": "string" } },
    "overall_concern_level": { "type": "string", "enum": ["minor", "moderate", "significant"] },
    "disclaimer": { "type": "string" }
  },
  "required": ["document_type", "is_offer_letter", "offer_summary", "clauses", "consultation_questions", "overall_concern_level", "disclaimer"],
  "additionalProperties": false
}
`;

async function testRun() {
  const prompt = `
You are an expert Indian labour lawyer AI. Analyze the provided employment offer letter text.
Extract data strictly matching the JSON schema below.
For any clauses involving numeric limits (e.g. bond duration, notice period), ensure you extract them into key_numbers.
Crucially, for consequence_scenarios, use hedged, calibrated language ("may be liable", "typically requires", "worth clarifying"). Do NOT use language of certainty (like "will be"). Ensure you are generating a nested array for consequence_steps.

REQUIRED JSON SCHEMA - output ONLY this object, no markdown, no code fences:
${schemaString}

Offer Letter Text:
${offerLetterText}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });
    console.log(result.response.text());
  } catch (e) {
    console.error(e);
  }
}

testRun();
