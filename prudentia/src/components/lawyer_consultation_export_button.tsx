/**
 * lawyer_consultation_export_button.tsx
 *
 * Button that triggers the lawyer consultation export via window.print().
 * No external libraries — uses the export builder to generate HTML and opens
 * a new window for printing.
 *
 * Functional only — no styling yet.
 */

import React from 'react';
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator';
import { printLawyerConsultationExport } from '../logic/lawyer_consultation_export_builder';
import { buildRangeComparisonsForClause } from '../logic/clause_range_comparator';
import type { RangeComparisonResult } from '../logic/clause_range_comparator';

interface LawyerConsultationExportButtonProps {
  analysis: OfferLetterAnalysis;
}

export function LawyerConsultationExportButton({
  analysis,
}: LawyerConsultationExportButtonProps): React.ReactElement {
  const handleExport = () => {
    // Build range comparisons for all clauses upfront
    const rangeComparisonsByClauseId: Record<string, RangeComparisonResult[]> = {};
    for (const clause of analysis.clauses) {
      rangeComparisonsByClauseId[clause.id] = buildRangeComparisonsForClause(
        clause.clause_type,
        clause.key_numbers
      );
    }

    printLawyerConsultationExport(analysis, { rangeComparisonsByClauseId });
  };

  return (
    <div id="export-button-container">
      <button
        id="lawyer-consultation-export-btn"
        type="button"
        aria-label="Generate printable lawyer consultation briefing note from this analysis"
        onClick={handleExport}
      >
        Export for Lawyer Consultation
      </button>
      <p>
        <small>
          Generates a printable briefing note with all clauses, statute citations, and{' '}
          {analysis.consultation_questions.length} document-specific questions for your lawyer.
          No data is sent anywhere — the document is generated locally and opened for printing.
        </small>
      </p>
    </div>
  );
}
