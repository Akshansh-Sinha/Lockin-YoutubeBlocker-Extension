import type { Rule, Verdict, Context } from './types';
import { whitelistRule } from './rules/whitelist';

const rules: Rule[] = [
  // Disabled rule: if blocking is disabled, allow all
  (ctx: Context): Verdict | null => {
    if (ctx.override.disabled) {
      return { action: 'allow', reason: 'Blocking disabled' };
    }
    return null;
  },

  // Override rule: if override is active, allow all
  (ctx: Context): Verdict | null => {
    if (ctx.override.activeUntil !== null && ctx.now < ctx.override.activeUntil) {
      return { action: 'allow', reason: 'Override active' };
    }
    return null;
  },

  // Whitelist rule (Phase 1)
  whitelistRule,

  // Default: block (fail closed)
  (): Verdict => ({
    action: 'block',
    reason: 'Default deny',
  }),
];

export async function getVerdict(ctx: Context): Promise<Verdict> {
  try {
    for (const rule of rules) {
      const verdict = rule(ctx);
      if (verdict !== null) {
        return verdict;
      }
    }
    // Should not reach here (default rule always returns)
    return { action: 'block', reason: 'No verdict' };
  } catch (error) {
    console.error('[FocusedTube] Decision engine error:', error);
    return { action: 'block', reason: 'Internal error' };
  }
}
