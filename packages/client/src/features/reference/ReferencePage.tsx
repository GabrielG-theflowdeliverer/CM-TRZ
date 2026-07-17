import { useState } from 'react';
import {
  ABOUT_TEXT,
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  ADKAR_TACTICS,
  ASPECTS_OF_CHANGE,
  IMPACT_SCORING_GUIDE,
  LICENSE_NOTE,
  PCT_INTRO,
} from '@cmt/domain';

const TABS = ['10 Aspects of Change', 'ADKAR Tactics', 'About'] as const;

export function ReferencePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Methodology Reference</h2>
        <p className="text-sm text-slate-500">Prosci definitions, examples and tactics libraries.</p>
      </div>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            className={`rounded-t px-3 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === '10 Aspects of Change' && (
        <div className="space-y-3">
          <div className="cmt-card bg-indigo-50/40 text-xs leading-relaxed text-slate-600">{IMPACT_SCORING_GUIDE}</div>
          {ASPECTS_OF_CHANGE.map((aspect) => (
            <div key={aspect.key} className="cmt-card">
              <h3 className="font-semibold">{aspect.label}</h3>
              <p className="text-sm text-slate-600">{aspect.definition}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'ADKAR Tactics' && (
        <div className="space-y-3">
          {ADKAR_ELEMENTS.map((el) => (
            <div key={el} className="cmt-card">
              <h3 className="mb-1 font-semibold text-indigo-800">{ADKAR_LABELS[el]} tactics</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {ADKAR_TACTICS[el].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'About' && (
        <div className="space-y-3">
          <div className="cmt-card">
            <h3 className="mb-1 font-semibold">About this tool</h3>
            <p className="text-sm text-slate-600">
              Change Management Tool is a web workspace with feature parity to Prosci Proxima Offline, extended with
              multi-project support, repeatable assessments and versionable ADKAR blueprints.
            </p>
          </div>
          <div className="cmt-card">
            <h3 className="mb-1 font-semibold">The Prosci Methodology</h3>
            <p className="text-sm text-slate-600">{ABOUT_TEXT}</p>
            <p className="mt-2 text-sm text-slate-600">{PCT_INTRO}</p>
          </div>
          <div className="cmt-card border-amber-200 bg-amber-50/50">
            <h3 className="mb-1 font-semibold">License</h3>
            <p className="text-sm text-slate-600">{LICENSE_NOTE}</p>
          </div>
        </div>
      )}
    </div>
  );
}
