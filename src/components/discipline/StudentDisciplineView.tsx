import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface StudentDisciplineViewProps {
  records: unknown;
}

const displayText = (record: Record<string, unknown>, key: string, fallback = ''): string => {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
};

export const StudentDisciplineView: React.FC<StudentDisciplineViewProps> = ({ records }) => {
  const incidents = Array.isArray(records)
    ? records.filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object')
    : [];

  return (
    <section className="space-y-5" aria-labelledby="student-discipline-title">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-800/60 bg-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-950 p-3 text-rose-300"><ShieldAlert className="h-6 w-6" /></div>
          <div>
            <h2 id="student-discipline-title" className="text-lg font-bold text-white">Discipline History</h2>
            <p className="text-xs text-slate-400">Your verified department records, in read-only mode.</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-700 bg-emerald-950 px-3 py-1 text-[10px] font-mono font-bold text-emerald-300">
          VIEW ONLY
        </span>
      </header>
      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          No discipline incidents are recorded on your profile.
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((record, index) => {
            const status = displayText(record, 'status', 'OPEN');
            return (
              <article key={displayText(record, 'id', String(index))} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-rose-200">
                      {displayText(record, 'category', displayText(record, 'issue', 'Discipline incident'))}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {displayText(record, 'date', 'Date unavailable')}
                      {displayText(record, 'time') ? ` · ${displayText(record, 'time')}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-200">{status.replace('_', ' ')}</span>
                </div>
                {displayText(record, 'rule_violated', displayText(record, 'ruleViolated')) && (
                  <p className="mt-3 text-sm text-slate-300">
                    {displayText(record, 'rule_violated', displayText(record, 'ruleViolated'))}
                  </p>
                )}
                {displayText(record, 'remark', displayText(record, 'remarks')) && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {displayText(record, 'remark', displayText(record, 'remarks'))}
                  </p>
                )}
                {displayText(record, 'action_taken', displayText(record, 'warning_action')) && (
                  <p className="mt-2 text-xs text-slate-400">
                    Staff action: {displayText(record, 'action_taken', displayText(record, 'warning_action'))}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
