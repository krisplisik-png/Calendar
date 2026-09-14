import type { Lesson } from '../types';
import { DateTime } from 'luxon';

export const HOMEWORK_DATE_KEY = '__homework';

export function isRecurringLesson(lesson: Pick<Lesson, 'recurrenceWeekdays' | 'recurrenceUntil'>): boolean {
  return Boolean(lesson.recurrenceWeekdays?.length && lesson.recurrenceUntil);
}

export function homeworkForOccurrence(
  lesson: Pick<Lesson, 'homework' | 'parentCommentByDate' | 'recurrenceWeekdays' | 'recurrenceUntil'>,
  occurrenceDate: string,
): string {
  const datedHomework = lesson.parentCommentByDate?.[occurrenceDate]?.[HOMEWORK_DATE_KEY];
  if (typeof datedHomework === 'string') return datedHomework;
  return isRecurringLesson(lesson) ? '' : lesson.homework ?? '';
}

export function nextLessonOccurrenceDate(
  lesson: Pick<Lesson, 'date' | 'recurrenceWeekdays' | 'recurrenceUntil' | 'excludedDates'>,
  occurrenceDate: string,
): string | undefined {
  const weekdays = lesson.recurrenceWeekdays ?? [];
  if (!weekdays.length || !lesson.recurrenceUntil) return undefined;

  const end = DateTime.fromISO(lesson.recurrenceUntil).startOf('day');
  const excluded = new Set(lesson.excludedDates ?? []);
  for (let cursor = DateTime.fromISO(occurrenceDate).plus({ days: 1 }).startOf('day'); cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const date = cursor.toFormat('yyyy-MM-dd');
    if (weekdays.includes(cursor.weekday) && !excluded.has(date)) return date;
  }
  return undefined;
}
