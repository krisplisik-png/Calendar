import type { Lesson } from '../types';

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
