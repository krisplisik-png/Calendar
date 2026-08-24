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
  const occurrences = lessons.filter(lesson => lesson.groupId === participantId)
    .flatMap(lesson => expandLessonOccurrences(lesson).map(item => ({ date: item.occurrenceDate, billingType: lesson.billingType ?? (lesson.recurrenceWeekdays?.length ? 'subscription' : 'single') })))
    .filter(item => item.date >= start && item.date <= end);
  return {
    scheduled: occurrences.length,
    completed: occurrences.filter(item => item.date <= today).length,
    subscription: occurrences.filter(item => item.billingType === 'subscription').length,
    single: occurrences.filter(item => item.billingType === 'single').length,
  };
}

export function calculateAmountDue(subscriptionLessons: number, subscriptionPrice: number, singleLessons: number, singlePrice: number) {
  return subscriptionLessons * Math.max(subscriptionPrice, 0) + singleLessons * Math.max(singlePrice, 0);
}

export function getPaymentStatus(amountDue: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return 'unpaid';
  if (amountDue > 0 && amountPaid >= amountDue) return 'paid';
  return 'partial';
}
