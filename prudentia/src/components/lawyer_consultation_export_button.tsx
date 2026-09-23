import React from 'react';
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator';
import { printLawyerConsultationExport } from '../logic/lawyer_consultation_export_builder';

interface LawyerConsultationExportButtonProps {
  analysis: OfferLetterAnalysis;
  fileName: string | null;
}

export function LawyerConsultationExportButton({ analysis, fileName }: LawyerConsultationExportButtonProps): React.ReactElement {
  const handleExport = () => {
    printLawyerConsultationExport(analysis, fileName ?? 'offer-letter');
  };

  return (
    <button
      id="lawyer-export-btn"
      className="btn btn-primary"
      type="button"
      onClick={handleExport}
      aria-label="Generate lawyer consultation document"
    >
      ↗ Export for Lawyer Consultation
    </button>
  );
}
