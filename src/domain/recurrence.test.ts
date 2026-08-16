import { describe, expect, it } from 'vitest';
import { expandLessonOccurrences } from './recurrence';
import type { Lesson } from '../types';

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1', schoolId: 'peakway', groupId: 'group-1',
    date: '2026-08-17', startTime: '10:00', endTime: '11:00',
    recurrenceWeekdays: [1, 3], recurrenceUntil: '2026-08-26',
    createdAt: {} as Lesson['createdAt'], updatedAt: {} as Lesson['updatedAt'],
    ...overrides,
  };
}

describe('expandLessonOccurrences', () => {
  it('creates lessons only on selected weekdays through the end date', () => {
    expect(expandLessonOccurrences(lesson()).map(item => item.occurrenceDate)).toEqual([
      '2026-08-17', '2026-08-19', '2026-08-24', '2026-08-26',
    ]);
  });

  it('omits one deleted occurrence without removing the series', () => {
    expect(expandLessonOccurrences(lesson({ excludedDates: ['2026-08-19'] })).map(item => item.occurrenceDate)).toEqual([
      '2026-08-17', '2026-08-24', '2026-08-26',
    ]);
  });

  it('keeps a non-recurring lesson as one occurrence', () => {
    expect(expandLessonOccurrences(lesson({ recurrenceWeekdays: [], recurrenceUntil: '' }))).toHaveLength(1);
  });
});
