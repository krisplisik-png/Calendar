import { DateTime } from 'luxon';
import type { Lesson } from '../types';

export interface LessonOccurrence {
  lesson: Lesson;
  occurrenceDate: string;
}

export function expandLessonOccurrences(lesson: Lesson): LessonOccurrence[] {
  const weekdays = lesson.recurrenceWeekdays ?? [];
  const until = lesson.recurrenceUntil;
  if (!weekdays.length || !until) return [{ lesson, occurrenceDate: lesson.date }];

  const start = DateTime.fromISO(lesson.date).startOf('day');
  const end = DateTime.fromISO(until).startOf('day');
  if (!start.isValid || !end.isValid || end < start) return [];

  const excluded = new Set(lesson.excludedDates ?? []);
  const occurrences: LessonOccurrence[] = [];
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const date = cursor.toFormat('yyyy-MM-dd');
    if (weekdays.includes(cursor.weekday) && !excluded.has(date)) {
      occurrences.push({ lesson, occurrenceDate: date });
    }
  }
  return occurrences;
}
