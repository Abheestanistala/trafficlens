import { useMemo } from 'react'
import type { Session } from '../model/session'
import { parseExpr } from './filter/expr'
import type { Analyzer } from './analyze/findings'
import type { Rule, RuleColor } from '../store/prefs'

type Compiled = { rule: Rule; test: (s: Session) => boolean }

export const compileRules = (rules: Rule[]): { ok: Compiled[]; errors: Record<string, string> } => {
  const ok: Compiled[] = []
  const errors: Record<string, string> = {}
  for (const rule of rules) {
    if (!rule.enabled) continue
    try {
      ok.push({ rule, test: parseExpr(rule.expr) })
    } catch (e) {
      errors[rule.id] = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok, errors }
}

export const useCompiledRules = (rules: Rule[]) => useMemo(() => compileRules(rules), [rules])

export const firstColor = (c: Compiled[], s: Session): RuleColor | undefined => {
  for (const { rule, test } of c) if (rule.color && test(s)) return rule.color
}

/** Rules with an `alert` become analyzers, so they show up as findings. */
export const rulesAsAnalyzers = (c: Compiled[]): Analyzer[] =>
  c.filter((x) => x.rule.alert).map(({ rule, test }) => ({
    id: `rule:${rule.id}`,
    name: rule.name,
    run: (all) => {
      const hit = all.filter(test)
      return hit.length ? [{ severity: rule.alert!.severity, category: 'Custom rule', title: `${rule.name}: ${hit.length} match${hit.length > 1 ? 'es' : ''}`, detail: rule.alert!.message || rule.expr, sessionIds: hit.map((s) => s.id) }] : []
    },
  }))
