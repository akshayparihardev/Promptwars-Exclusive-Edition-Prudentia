import type { OfferLetterAnalysis } from '../logic/analysis_schema_validator.js';
import './risk_summary_dashboard.css';

export function RiskSummaryDashboard({ analysis }: { analysis: OfferLetterAnalysis }) {
  const significant = analysis.clauses.filter(c => c.concern_level === 'significant').length;
  const moderate = analysis.clauses.filter(c => c.concern_level === 'moderate').length;
    
  const totalStatutes = new Set(
    analysis.clauses.flatMap(c => (c.applicable_law || []).map(l => l.act + l.section))
  ).size;
  
  const totalScenarios = analysis.clauses.reduce((acc, c) => acc + (c.consequence_scenarios?.length || 0), 0);

  return (
    <div className="risk-dashboard">
      <div className="risk-header">
        <div className="risk-gauge">
          <span className="gauge-label">Overall Concern Level:</span>
          <span className={`gauge-value concern-${analysis.overall_concern_level}`}>
            {analysis.overall_concern_level.toUpperCase()}
          </span>
        </div>
      </div>
      
      <div className="risk-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{analysis.clauses.length}</div>
          <div className="stat-label">Clauses Analyzed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-500">{significant}</div>
          <div className="stat-label">Significant Risks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-amber-500">{moderate}</div>
          <div className="stat-label">Moderate Risks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-blue-500">{totalStatutes}</div>
          <div className="stat-label">Statutes Cited</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-purple-500">{totalScenarios}</div>
          <div className="stat-label">Scenarios Modeled</div>
        </div>
      </div>
    </div>
  );
}
