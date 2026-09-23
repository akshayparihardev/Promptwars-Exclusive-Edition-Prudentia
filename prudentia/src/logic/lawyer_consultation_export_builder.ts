/**
 * lawyer_consultation_export_builder.ts
 *
 * Generates a printable HTML document from the analysis results for use in a
 * lawyer consultation. Uses window.print() — no external libraries required.
 *
 * Design principle:
 *   This export is the "prepare for a professional" use-case from the PS coverage table.
 *   The output must be:
 *   - Document-specific (consultation_questions are generated from actual findings)
 *   - Honest about what it is (not a legal opinion — a structured briefing note)
 *   - Print-ready (clean layout, page breaks, no interactive elements)
 *   - Self-contained (single HTML string, no external CSS, no external scripts)
 *
 * What it includes:
 *   1. Document/offer summary (company, role, CTC, joining date)
 *   2. Overall concern level with explanation
 *   3. Per-clause breakdown: clause title, exact_quote, concern_level, plain_english,
 *      applicable_law citations, key numbers, consequence scenarios (text format)
 *   4. Generated consultation_questions (specific to this document)
 *   5. Mandatory disclaimer (prominent, not a footer footnote)
 *   6. Non-authoritative label on all typical range references
 */

import type { OfferLetterAnalysis, OfferClause } from './analysis_schema_validator';
import { getClauseTypeLabel } from './clause_to_statute_matcher';
import type { RangeComparisonResult } from './clause_range_comparator';
import { buildScenariosExportText } from './consequence_scenario_formatter';
import type { FormattedConsequenceScenario } from './consequence_scenario_formatter';
import { formatClauseScenarios } from './consequence_scenario_formatter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function concernLevelBadge(level: 'minor' | 'moderate' | 'significant'): string {
  const colors: Record<string, string> = {
    minor: '#2d6a4f',
    moderate: '#b5830a',
    significant: '#9b2226',
  };
  const labels: Record<string, string> = {
    minor: 'Minor concern',
    moderate: 'Moderate concern',
    significant: 'Significant concern',
  };
  return `<span style="background:${colors[level]};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">${labels[level].toUpperCase()}</span>`;
}

function buildClauseHtml(
  clause: OfferClause,
  rangeComparisons: RangeComparisonResult[],
  index: number
): string {
  const formattedScenarios = formatClauseScenarios(
    clause.id,
    clause.clause_type,
    clause.consequence_scenarios
  );
  const scenariosText = buildScenariosExportText(formattedScenarios.scenarios);

  const applicableLawHtml = clause.applicable_law.length > 0
    ? clause.applicable_law
        .map((law) => `<li>${escapeHtml(law.act)}, Section ${escapeHtml(law.section)}</li>`)
        .join('')
    : '<li>No specific statute cited (general clause)</li>';

  const keyNumbersHtml = (() => {
    const parts: string[] = [];
    const { duration_months, amount_inr, notice_days } = clause.key_numbers;
    if (duration_months !== null) parts.push(`Duration: <strong>${duration_months} months</strong>`);
    if (amount_inr !== null) parts.push(`Amount: <strong>₹${amount_inr.toLocaleString('en-IN')}</strong>`);
    if (notice_days !== null) parts.push(`Notice period: <strong>${notice_days} days</strong>`);
    return parts.length > 0 ? parts.join(' &nbsp;|&nbsp; ') : 'No specific numbers extracted';
  })();

  const rangeHtml = rangeComparisons.length > 0
    ? `<div style="margin:8px 0;padding:8px;background:#fffbeb;border-left:3px solid #b5830a;">
        <strong>Typical range comparison (non-authoritative):</strong>
        ${rangeComparisons
          .map(
            (r) =>
              `<p style="margin:4px 0;">${escapeHtml(r.summary)}<br>
               <em style="font-size:11px;color:#666;">${escapeHtml(r.non_authoritative_label)}</em></p>`
          )
          .join('')}
      </div>`
    : '';

  return `
    <div style="page-break-inside:avoid;margin:0 0 24px 0;border:1px solid #ddd;border-radius:6px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <h3 style="margin:0;font-size:15px;">${index + 1}. ${escapeHtml(clause.title)}</h3>
        ${concernLevelBadge(clause.concern_level)}
      </div>
      <p style="font-size:11px;color:#666;margin:0 0 4px 0;">Type: ${escapeHtml(getClauseTypeLabel(clause.clause_type as Parameters<typeof getClauseTypeLabel>[0]))}</p>
      ${clause.page_hint ? `<p style="font-size:11px;color:#666;margin:0 0 8px 0;">Approx. page: ${clause.page_hint}</p>` : ''}

      <div style="background:#f8f8f8;padding:10px;border-left:3px solid #999;margin:8px 0;font-style:italic;font-size:13px;">
        ${escapeHtml(clause.exact_quote)}
      </div>

      <p style="margin:8px 0;"><strong>Plain language:</strong> ${escapeHtml(clause.plain_english)}</p>
      <p style="margin:8px 0;"><strong>Key numbers:</strong> ${keyNumbersHtml}</p>
      ${rangeHtml}

      <p style="margin:8px 0;"><strong>Why this matters:</strong> ${escapeHtml(clause.concern_rationale)}</p>

      <p style="margin:8px 0;"><strong>Applicable Indian law:</strong></p>
      <ul style="margin:4px 0 8px 16px;">${applicableLawHtml}</ul>

      <div style="background:#fff8f0;padding:10px;border-left:3px solid #e67e00;margin:8px 0;">
        <strong>What happens if this clause is triggered:</strong>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;margin:8px 0 0 0;">${escapeHtml(scenariosText)}</pre>
      </div>
    </div>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Range comparison results keyed by clause id — optional, shows if provided. */
  rangeComparisonsByClauseId?: Record<string, RangeComparisonResult[]>;
}

/**
 * Builds a complete, self-contained HTML string for the lawyer consultation export.
 * Call window.print() after injecting this into a hidden iframe or a new window.
 *
 * @param analysis - The validated OfferLetterAnalysis from the API
 * @param options - Optional export configuration
 * @returns A complete HTML document string (includes <html>, <head>, <body>)
 */
export function buildLawyerConsultationExport(
  analysis: OfferLetterAnalysis,
  options: ExportOptions = {}
): string {
  const { rangeComparisonsByClauseId = {} } = options;

  const exportDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const offerSummaryHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;width:30%;"><strong>Company</strong></td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${escapeHtml(analysis.offer_summary.company ?? 'Not stated')}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><strong>Role</strong></td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${escapeHtml(analysis.offer_summary.role ?? 'Not stated')}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><strong>CTC</strong></td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${escapeHtml(analysis.offer_summary.ctc ?? 'Not stated')}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;"><strong>Joining Date</strong></td>
        <td style="padding:6px 12px;border:1px solid #ddd;">${escapeHtml(analysis.offer_summary.joining_date ?? 'Not stated')}</td>
      </tr>
    </table>`;

  const clausesHtml = analysis.clauses
    .map((clause, i) =>
      buildClauseHtml(clause, rangeComparisonsByClauseId[clause.id] ?? [], i)
    )
    .join('');

  const consultationQuestionsHtml = analysis.consultation_questions
    .map((q, i) => `<li style="margin:8px 0;">${i + 1}. ${escapeHtml(q)}</li>`)
    .join('');

  const unansweredHtml = analysis.unanswered_questions.length > 0
    ? `<div style="margin:16px 0;padding:12px;background:#fff0f0;border:1px solid #e0a0a0;border-radius:6px;">
        <strong>Topics not addressed in this document:</strong>
        <ul style="margin:8px 0 0 16px;">
          ${analysis.unanswered_questions.map((q) => `<li style="margin:4px 0;">${escapeHtml(q)}</li>`).join('')}
        </ul>
        <p style="font-size:11px;color:#666;margin:8px 0 0 0;">These topics were asked about but are not stated anywhere in the offer letter. Consider asking the employer to address them explicitly.</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Prudentia — Lawyer Consultation Briefing Note</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 13px;
      line-height: 1.6;
      color: #222;
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
    .disclaimer-box {
      background: #fffbeb;
      border: 2px solid #b5830a;
      border-radius: 6px;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 12px;
    }
    .overall-concern {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#e8f4fd;padding:12px 16px;margin-bottom:16px;border-radius:6px;font-family:sans-serif;font-size:13px;">
    <strong>Ready to print?</strong> Click <button onclick="window.print()" style="cursor:pointer;padding:4px 12px;margin-left:8px;">Print / Save as PDF</button>
    &nbsp; This document contains no links or external content — safe to print offline.
  </div>

  <h1>Prudentia — Offer Letter Analysis Briefing Note</h1>
  <p style="color:#666;font-size:12px;margin:0 0 16px 0;">Generated: ${exportDate} &nbsp;|&nbsp; For use in professional legal consultation only</p>

  <div class="disclaimer-box">
    <strong>⚠ Important — Read Before Sharing:</strong><br>
    ${escapeHtml(analysis.disclaimer)}<br><br>
    This document was generated by an AI system (Prudentia) and is intended as a structured briefing note to assist a qualified lawyer in providing advice. It is NOT a legal opinion and does NOT constitute legal advice. All statute citations should be independently verified. Typical range comparisons are non-authoritative observed-practice data, not legal standards.
  </div>

  <h2>Offer Summary</h2>
  ${offerSummaryHtml}

  <p><strong>Overall concern level:</strong>
    <span class="overall-concern" style="background:${
      analysis.overall_concern_level === 'significant' ? '#9b2226' :
      analysis.overall_concern_level === 'moderate' ? '#b5830a' : '#2d6a4f'
    };color:white;">${analysis.overall_concern_level.toUpperCase()}</span>
  </p>

  <h2>Clause Analysis (${analysis.clauses.length} clause${analysis.clauses.length !== 1 ? 's' : ''} identified)</h2>
  ${clausesHtml || '<p>No clauses requiring attention were identified in this document.</p>'}

  ${unansweredHtml}

  <h2>Questions to Raise with Your Lawyer</h2>
  <p style="font-size:11px;color:#666;margin-bottom:8px;">These questions were generated specifically from the contents of this offer letter — they are not generic boilerplate.</p>
  <ol style="margin:0;padding-left:20px;">
    ${consultationQuestionsHtml}
  </ol>

  <h2>Document Details</h2>
  <p>Document type identified as: <strong>${escapeHtml(analysis.document_type)}</strong></p>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#888;">
    Prepared using Prudentia — AI-assisted offer letter analysis for Indian engineering students.<br>
    Analysis is grounded in Indian statute text (Indian Contract Act 1872, Specific Relief Act 1963, etc.) — cite original statutes in any legal proceeding, not this document.<br>
    This briefing note was created on ${exportDate}.
  </div>
</body>
</html>`;
}

/**
 * Opens a new browser window with the export HTML and triggers window.print().
 * This is the primary call from the lawyer_consultation_export_button component.
 *
 * @param analysis - The validated analysis
 * @param options - Export options (range comparisons etc.)
 */
export function printLawyerConsultationExport(
  analysis: OfferLetterAnalysis,
  options: ExportOptions = {}
): void {
  const html = buildLawyerConsultationExport(analysis, options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Could not open print window. Please allow pop-ups for this site.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Small delay to ensure document is fully rendered before print dialog
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
