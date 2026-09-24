import React from 'react';
import './two_pane_layout.css';

interface TwoPaneLayoutProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

export function TwoPaneLayout({ leftPane, rightPane }: TwoPaneLayoutProps) {
  return (
    <div className="two-pane-layout">
      <div className="pane left-pane">
        {leftPane}
      </div>
      <div className="pane right-pane">
        {rightPane}
      </div>
    </div>
  );
}
