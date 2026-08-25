import { describe, expect, it, vi } from 'vitest';
import { buildParentLessons, generateParentToken } from './parentViews';

describe('parent views', () => {
  it('creates a URL-safe token with 32 random bytes', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });
    const token = generateParentToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    vi.unstubAllGlobals();
  });

  it('does not expose internal lesson fields or another child', () => {
    const stamp = {} as never;
    const lessons = buildParentLessons(
      ['s1'],
      [{ id: 's1', schoolId: 'school', fullName: 'Маша', groupIds: ['g1'], active: true, createdAt: stamp, updatedAt: stamp }, { id: 's2', schoolId: 'school', fullName: 'Саша', groupIds: ['g2'], active: true, createdAt: stamp, updatedAt: stamp }],
      [{ id: 'g1', schoolId: 'school', name: 'English', color: '#fff', studentIds: [], createdAt: stamp, updatedAt: stamp }],
      [{ id: 'l1', schoolId: 'school', groupId: 'g1', date: '2026-09-01', startTime: '10:00', endTime: '11:00', notes: 'private', billingType: 'single', createdAt: stamp, updatedAt: stamp }],
      [], ['2026-09'],
    );
    expect(lessons['2026-09']).toHaveLength(1);
    expect(lessons['2026-09'][0]).not.toHaveProperty('notes');
    expect(lessons['2026-09'][0]).not.toHaveProperty('billingType');
    expect(lessons['2026-09'][0].studentIds).toEqual(['s1']);
  });
});
