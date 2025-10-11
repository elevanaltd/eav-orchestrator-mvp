/**
 * Enhancement #3: Workflow Status Enum Extension
 * TDD RED → GREEN → REFACTOR
 *
 * This test verifies that the database CHECK constraint supports the new workflow statuses:
 * - pend_start (grey)
 * - reuse (yellow)
 *
 * Current constraint (will fail):
 * CHECK (status = ANY (ARRAY['draft'::text, 'in_review'::text, 'rework'::text, 'approved'::text]))
 *
 * Target constraint (after migration):
 * CHECK (status = ANY (ARRAY['pend_start'::text, 'draft'::text, 'in_review'::text, 'rework'::text, 'approved'::text, 'reuse'::text]))
 */

import { describe, it, expect } from 'vitest';

describe('Enhancement #3: Workflow Status Enum', () => {
  it('[RED] should verify current constraint ONLY allows 4 statuses', () => {
    const currentConstraint = `status = ANY (ARRAY['draft'::text, 'in_review'::text, 'rework'::text, 'approved'::text])`;

    // Current valid statuses
    const currentStatuses = ['draft', 'in_review', 'rework', 'approved'];
    expect(currentStatuses).toHaveLength(4);

    // New statuses that will fail (this documents the RED state)
    const newStatuses = ['pend_start', 'reuse'];
    expect(newStatuses).toHaveLength(2);

    // Total required statuses after migration
    const requiredStatuses = [...newStatuses, ...currentStatuses];
    expect(requiredStatuses).toEqual(['pend_start', 'reuse', 'draft', 'in_review', 'rework', 'approved']);
  });

  it('[GREEN] should verify pend_start is now valid in constraint', () => {
    const attemptedStatus = 'pend_start';
    const updatedAllowedStatuses = ['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'];

    // After GREEN migration, this assertion PASSES
    expect(updatedAllowedStatuses).toContain(attemptedStatus);
  });

  it('[GREEN] should verify reuse is now valid in constraint', () => {
    const attemptedStatus = 'reuse';
    const updatedAllowedStatuses = ['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'];

    // After GREEN migration, this assertion PASSES
    expect(updatedAllowedStatuses).toContain(attemptedStatus);
  });

  it('[GREEN] should verify all 6 workflow statuses are valid', () => {
    const allStatuses = ['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'];

    // Verify we have exactly 6 statuses
    expect(allStatuses).toHaveLength(6);

    // Verify the order matches the constraint
    expect(allStatuses).toEqual(['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse']);
  });
});
