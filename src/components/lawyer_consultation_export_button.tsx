import React from 'react';
import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator.js';
import { printLawyerConsultationExport } from '../logic/lawyer_consultation_export_builder.js';
import { IconExternalLink } from './icons.js';

interface LawyerConsultationExportButtonProps {
  analysis: OfferLetterAnalysis;
  fileName: string | null;
}

export function LawyerConsultationExportButton({ analysis }: LawyerConsultationExportButtonProps): React.ReactElement {
  const handleExport = () => {
    printLawyerConsultationExport(analysis, {});
  };

  return (
    <button
      id="lawyer-export-btn"
      className="btn btn-primary"
      type="button"
      onClick={handleExport}
      aria-label="Generate lawyer consultation document"
    >
<IconExternalLink size={14} /> Export for Lawyer Consultation
    </button>
  );
}
