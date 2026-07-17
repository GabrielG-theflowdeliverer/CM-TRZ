import { ACTIVITY_STATUSES, ADKAR_ELEMENTS, ADKAR_LABELS, PLAN_COLUMN_HELP, ROSTER_LABELS } from '@cmt/domain';
import type { Activity, GroupDto, PlanDto, RoleDto } from '../../lib/types';
import type { BlueprintDto } from '../../lib/types';
import { DateInput, Select, TextArea, TextField } from '../../ui/controls';
import { MultiSelect } from '../../ui/MultiSelect';

export interface ActivityTableContext {
  groups: GroupDto[];
  plans: PlanDto[];
  blueprints: BlueprintDto[];
  roles: RoleDto[];
  onUpdate: (id: string, fields: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

const OVERALL = '__overall__';

export function roleLabel(role: RoleDto): string {
  const base = role.roleName ?? ROSTER_LABELS[role.roster as keyof typeof ROSTER_LABELS] ?? 'Role';
  return role.personName ? `${base}: ${role.personName}` : base;
}

/**
 * The unified activity grid: every activity row edits name, ADKAR outcomes,
 * impacted groups (incl. Overall Change), plans, roster roles, dates, status
 * and result — the interconnected Blueprints-and-Plans model.
 */
export function ActivityTable(props: { activities: Activity[]; ctx: ActivityTableContext; hideColumns?: string[] }) {
  const { ctx } = props;
  const hidden = new Set(props.hideColumns ?? []);
  const groupOptions = [
    { value: OVERALL, label: 'Overall Change' },
    ...ctx.groups.map((g) => ({ value: g.id, label: g.name })),
  ];
  const planOptions = ctx.plans.map((p) => ({ value: p.id, label: p.name }));
  const blueprintOptions = ctx.blueprints.map((b) => ({ value: b.id, label: b.name }));
  const roleOptions = ctx.roles.map((r) => ({ value: r.id, label: roleLabel(r) }));
  const adkarOptions = ADKAR_ELEMENTS.map((el) => ({ value: el, label: ADKAR_LABELS[el] }));

  const col = (key: string, header: string, className: string, title?: string) =>
    hidden.has(key) ? null : (
      <th key={key} className={`cmt-th ${className}`} title={title}>
        {header}
      </th>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1750px]">
        <thead>
          <tr>
            <th className="cmt-th w-8">#</th>
            {col('name', 'Activity Name (WHAT)', 'min-w-52', PLAN_COLUMN_HELP.activityName)}
            {col('adkar', 'ADKAR Outcome (WHY)', 'w-44', PLAN_COLUMN_HELP.adkarOutcome)}
            {col('groups', 'Impacted Group (WHO)', 'w-48', PLAN_COLUMN_HELP.group)}
            {col('plans', 'Plan(s)', 'w-44', 'Which CM plans deliver this activity?')}
            {col('blueprints', 'Blueprint(s)', 'w-44', 'Which saved blueprints include this activity?')}
            {col('roles', 'Role(s) Required (WHO)', 'w-48', PLAN_COLUMN_HELP.rolesRequired)}
            {col('method', 'Method / Mechanism (HOW)', 'min-w-44', PLAN_COLUMN_HELP.methodMechanism)}
            {col('responsible', 'Responsible', 'w-36', PLAN_COLUMN_HELP.responsible)}
            {col('start', 'Start', 'w-36', PLAN_COLUMN_HELP.startDate)}
            {col('finish', 'Finish', 'w-36', PLAN_COLUMN_HELP.finishDate)}
            {col('status', 'Status', 'w-32', PLAN_COLUMN_HELP.status)}
            {col('result', 'Result / Feedback', 'min-w-44', PLAN_COLUMN_HELP.resultFeedback)}
            <th className="cmt-th w-10"></th>
          </tr>
        </thead>
        <tbody>
          {props.activities.map((a, i) => {
            const groupSelection = [...(a.overall ? [OVERALL] : []), ...a.groupIds];
            return (
              <tr key={a.id}>
                <td className="cmt-td text-slate-400">{i + 1}</td>
                {!hidden.has('name') && (
                  <td className="cmt-td">
                    <TextArea rows={1} value={a.name} onSave={(v) => ctx.onUpdate(a.id, { name: v })} />
                  </td>
                )}
                {!hidden.has('adkar') && (
                  <td className="cmt-td">
                    <MultiSelect
                      options={adkarOptions}
                      selected={a.adkarOutcomes}
                      placeholder="ADKAR…"
                      onChange={(adkarOutcomes) => ctx.onUpdate(a.id, { adkarOutcomes })}
                    />
                  </td>
                )}
                {!hidden.has('groups') && (
                  <td className="cmt-td">
                    <MultiSelect
                      options={groupOptions}
                      selected={groupSelection}
                      placeholder="Groups…"
                      onChange={(values) =>
                        ctx.onUpdate(a.id, {
                          overall: values.includes(OVERALL),
                          groupIds: values.filter((v) => v !== OVERALL),
                        })
                      }
                    />
                  </td>
                )}
                {!hidden.has('plans') && (
                  <td className="cmt-td">
                    <MultiSelect
                      options={planOptions}
                      selected={a.planIds}
                      placeholder="Plans…"
                      onChange={(planIds) => ctx.onUpdate(a.id, { planIds })}
                    />
                  </td>
                )}
                {!hidden.has('blueprints') && (
                  <td className="cmt-td">
                    <MultiSelect
                      options={blueprintOptions}
                      selected={a.blueprintIds}
                      placeholder="Blueprints…"
                      onChange={(blueprintIds) => ctx.onUpdate(a.id, { blueprintIds })}
                    />
                  </td>
                )}
                {!hidden.has('roles') && (
                  <td className="cmt-td">
                    <MultiSelect
                      options={roleOptions}
                      selected={a.roleIds}
                      placeholder="Roles…"
                      emptyHint="No roles in the rosters yet."
                      onChange={(roleIds) => ctx.onUpdate(a.id, { roleIds })}
                    />
                    {a.rolesRequiredText && (
                      <p className="mt-0.5 truncate text-[10px] text-slate-400" title={a.rolesRequiredText}>
                        {a.rolesRequiredText}
                      </p>
                    )}
                  </td>
                )}
                {!hidden.has('method') && (
                  <td className="cmt-td">
                    <TextArea
                      rows={1}
                      value={a.methodMechanism}
                      onSave={(v) => ctx.onUpdate(a.id, { methodMechanism: v })}
                    />
                  </td>
                )}
                {!hidden.has('responsible') && (
                  <td className="cmt-td">
                    <TextField value={a.responsible} onSave={(v) => ctx.onUpdate(a.id, { responsible: v })} />
                  </td>
                )}
                {!hidden.has('start') && (
                  <td className="cmt-td">
                    <DateInput value={a.startDate} onSave={(v) => ctx.onUpdate(a.id, { startDate: v })} />
                  </td>
                )}
                {!hidden.has('finish') && (
                  <td className="cmt-td">
                    <DateInput value={a.finishDate} onSave={(v) => ctx.onUpdate(a.id, { finishDate: v })} />
                  </td>
                )}
                {!hidden.has('status') && (
                  <td className="cmt-td">
                    <Select
                      value={a.status}
                      options={ACTIVITY_STATUSES}
                      onSave={(v) => ctx.onUpdate(a.id, { status: v })}
                    />
                  </td>
                )}
                {!hidden.has('result') && (
                  <td className="cmt-td">
                    <TextArea
                      rows={1}
                      value={a.resultFeedback}
                      onSave={(v) => ctx.onUpdate(a.id, { resultFeedback: v })}
                    />
                  </td>
                )}
                <td className="cmt-td">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm('Delete this activity everywhere (all plans and blueprints)?')) ctx.onDelete(a.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          {props.activities.length === 0 && (
            <tr>
              <td colSpan={14} className="cmt-td py-6 text-center text-slate-400">
                No activities here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
