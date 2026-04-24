/**
 * @deprecated Import from '@/core/engine' directly.
 * This file exists only for backward compatibility and will be removed.
 */
export type { Verdict, Action } from '@/core/engine';

// Rule type is intentionally not re-exported — the rule-chain pattern is removed.
// See core/engine.ts decide() for the replacement.
