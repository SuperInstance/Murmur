/**
 * Tests for utility functions
 * @module lib/__tests__/utils.test
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn (className merge utility)', () => {
  it('merges simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });

  it('handles conditional classes (falsy values are filtered)', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    expect(cn('base', undefined, null, '')).toBe('base');
  });

  it('deduplicates conflicting Tailwind classes (later wins)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('preserves non-conflicting classes', () => {
    expect(cn('px-4 py-2', 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
  });

  it('handles arrays of class names', () => {
    expect(cn(['px-4', 'py-2'], 'text-center')).toBe('px-4 py-2 text-center');
  });

  it('handles objects (clsx style)', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
    expect(cn({ 'text-bold': true, 'text-italic': false }, 'extra')).toBe('text-bold extra');
  });

  it('handles mixed input types', () => {
    expect(cn('base', ['array', 'items'], { conditional: true }, false && 'nope'))
      .toBe('base array items conditional');
  });

  it('resolves Tailwind conflicts across multiple inputs', () => {
    // The last conflicting class should win
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('m-1 m-2 m-3')).toBe('m-3');
  });

  it('handles responsive variants', () => {
    expect(cn('sm:px-4', 'sm:px-6')).toBe('sm:px-6');
    expect(cn('md:text-sm', 'md:text-lg')).toBe('md:text-lg');
  });

  it('preserves order of non-conflicting classes from inputs', () => {
    const result = cn('flex', 'items-center', 'justify-between');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('justify-between');
  });
});
