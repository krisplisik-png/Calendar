import type { Lesson, StudentLessonStatus } from '../types';
import { DateTime } from 'luxon';
import { expandLessonOccurrences } from './recurrence';

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

export interface GroupLessonOccurrence {
  lesson: Lesson;
  occurrenceDate: string;
}

export function nextGroupLessonOccurrence(
  lessons: Lesson[],
  groupId: string,
  occurrenceDate: string,
  currentLessonId?: string,
  currentStartTime = '00:00',
): GroupLessonOccurrence | undefined {
  const currentKey = `${occurrenceDate}T${currentStartTime}`;
  return lessons
    .filter(lesson => lesson.groupId === groupId)
    .flatMap(lesson => expandLessonOccurrences(lesson))
    .filter(item => !(item.lesson.id === currentLessonId && item.occurrenceDate === occurrenceDate))
    .filter(item => `${item.occurrenceDate}T${item.lesson.startTime}` > currentKey)
    .sort((left, right) => `${left.occurrenceDate}T${left.lesson.startTime}`.localeCompare(`${right.occurrenceDate}T${right.lesson.startTime}`))[0];
}

export function homeworkForGroupOccurrence(
  lessons: Lesson[],
  groupId: string,
  occurrenceDate: string,
  preferredLessonId?: string,
): string {
  const groupLessons = lessons.filter(lesson => lesson.groupId === groupId);
  const preferred = groupLessons.find(lesson => lesson.id === preferredLessonId);
  const datedHomework = (lesson: Lesson | undefined) => {
    const comments = lesson?.parentCommentByDate?.[occurrenceDate];
    return comments && Object.prototype.hasOwnProperty.call(comments, HOMEWORK_DATE_KEY)
      ? comments[HOMEWORK_DATE_KEY]
      : undefined;
  };

  const preferredHomework = datedHomework(preferred);
  if (typeof preferredHomework === 'string' && preferredHomework.trim()) return preferredHomework;

  const actualOccurrenceLessons = groupLessons.filter(lesson =>
    expandLessonOccurrences(lesson).some(item => item.occurrenceDate === occurrenceDate),
  );
  for (const lesson of actualOccurrenceLessons) {
    const homework = datedHomework(lesson);
    if (typeof homework === 'string' && homework.trim()) return homework;
  }
  for (const lesson of groupLessons) {
    const homework = datedHomework(lesson);
    if (typeof homework === 'string' && homework.trim()) return homework;
  }

  if (typeof preferredHomework === 'string') return preferredHomework;
  const oneTimeLesson = actualOccurrenceLessons.find(lesson => !isRecurringLesson(lesson) && lesson.homework?.trim());
  return oneTimeLesson?.homework ?? '';
}

export function homeworkCanBeGraded(
  homework: string,
  savedStatus?: Pick<StudentLessonStatus, 'homeworkAssigned' | 'homeworkDone'>,
): boolean {
  return Boolean(homework.trim())
    || savedStatus?.homeworkAssigned === true
    || savedStatus?.homeworkDone === true;
}

export function homeworkFromPublicFeedback(feedback: { homework?: string } | undefined): string {
  return typeof feedback?.homework === 'string' ? feedback.homework.trim() : '';
}

export function summarizeHomeworkResults(
  feedback: Array<{ homeworkAssigned?: boolean; homeworkDone?: boolean } | undefined>,
): { done: number; total: number } {
  return feedback.reduce((summary, item) => {
    if (item?.homeworkAssigned === true) {
      summary.total += 1;
      if (item.homeworkDone === true) summary.done += 1;
    }
    return summary;
  }, { done: 0, total: 0 });
}
