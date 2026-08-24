import { DateTime } from 'luxon';
import { expandLessonOccurrences } from './recurrence';
import type { Lesson, PaymentStatus } from '../types';

export function getMonthPeriod(month: string) {
  const start = DateTime.fromFormat(month, 'yyyy-MM').startOf('month');
  if (!start.isValid) throw new Error('Некорректный месяц');
  return { start: start.toFormat('yyyy-MM-dd'), end: start.endOf('month').toFormat('yyyy-MM-dd') };
}

export function countParticipantLessons(lessons: Lesson[], participantId: string, month: string, today = DateTime.now().toISODate()!) {
  const { start, end } = getMonthPeriod(month);
  const dates = lessons.filter(lesson => lesson.groupId === participantId)
    .flatMap(lesson => expandLessonOccurrences(lesson).map(item => item.occurrenceDate))
    .filter(date => date >= start && date <= end);
  return { scheduled: dates.length, completed: dates.filter(date => date <= today).length };
}

export function getPaymentStatus(amountDue: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return 'unpaid';
  if (amountDue > 0 && amountPaid >= amountDue) return 'paid';
  return 'partial';
}
