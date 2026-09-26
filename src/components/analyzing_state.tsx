import React, { useEffect, useState } from 'react';
import { IconScale, IconSearch, IconInfo, IconArrowRight, IconCheck, IconFileText } from './icons.js';

/**
 * Client-side perceived-progress steps for the analysis wait.
 * The backend call is a single request/response (no real streaming - see
 * README), so this is a presentational step-by-step reveal to keep the
 * ~15-25s wait feeling alive rather than a static wall of text. It does not
 * claim to reflect real backend telemetry.
 */
const STEPS = [
  { Icon: IconFileText, label: 'Reading the document structure' },
  { Icon: IconScale, label: 'Injecting real Indian statute text (ICA 1872, SRA 1963)' },
  { Icon: IconSearch, label: 'Identifying and classifying clauses' },
  { Icon: IconInfo, label: 'Cross-checking numbers against the exact quotes' },
  { Icon: IconArrowRight, label: 'Modelling consequence scenarios per clause' },
  { Icon: IconCheck, label: 'Verifying every quote against the source PDF' },
] as const;

const STEP_INTERVAL_MS = 3200;

interface AnalyzingStateProps {
  fileName: string | null;
}

export function AnalyzingState({ fileName }: AnalyzingStateProps): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const current = STEPS[stepIndex];

  return (
    <div className="state-screen" role="status" aria-live="polite">
      <div className="state-card">
        <div className="state-wordmark"><IconScale size={16} /> Prudentia</div>
        <div className="state-spinner-wrap">
          <div className="state-spinner" />
        </div>
        <h2 className="state-headline">Analysing your offer letter</h2>
        <p className="state-file">{fileName}</p>
        <div className="state-status-message" aria-live="polite">
          {current.label}…
        </div>
        <div className="state-steps">
          {STEPS.map((step, i) => {
            const status = i < stepIndex ? 'is-done' : i === stepIndex ? 'is-active' : 'is-pending';
            const StepIcon = i < stepIndex ? IconCheck : step.Icon;
            return (
              <div key={step.label} className={`state-step ${status}`}>
                <StepIcon size={15} />
                {step.label}
              </div>
            );
          })}
        </div>
        <p className="state-footnote">This typically takes 15–25 seconds. We're being thorough.</p>
      </div>
    </div>
  );
}
