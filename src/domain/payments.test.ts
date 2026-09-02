import { describe, expect, it } from 'vitest';
import { calculateAmountDue, countParticipantLessons, getMonthPeriod, getPaymentStatus } from './payments';
import type { Lesson } from '../types';

const stamp = {} as Lesson['createdAt'];

describe('payment month calculations', () => {
  it('uses real calendar month boundaries including leap years', () => {
    expect(getMonthPeriod('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(getMonthPeriod('2026-04').end).toBe('2026-04-30');
    expect(getMonthPeriod('2026-08').end).toBe('2026-08-31');
  });

  it('counts only visible occurrences in the selected month', () => {
    const lessons: Lesson[] = [{ id: '1', schoolId: 'peakway', groupId: 'g1', date: '2026-08-03', startTime: '10:00', endTime: '11:00', recurrenceWeekdays: [1], recurrenceUntil: '2026-09-07', excludedDates: ['2026-08-17'], createdAt: stamp, updatedAt: stamp }];
    expect(countParticipantLessons(lessons, 'g1', '2026-08', '2026-08-20')).toEqual({ scheduled: 4, completed: 2, subscription: 4, single: 0 });
  });

  it('calculates the invoice from subscription and single lesson prices', () => {
    expect(calculateAmountDue(8, 900, 1, 1200)).toBe(8400);
  });

  it('automatically counts every Monday and Thursday plus a single lesson', () => {
    const lessons: Lesson[] = [
      { id: 'series', schoolId: 'peakway', groupId: 'g1', date: '2026-08-03', startTime: '17:00', endTime: '18:00', recurrenceWeekdays: [1, 4], recurrenceUntil: '2026-08-31', billingType: 'subscription', createdAt: stamp, updatedAt: stamp },
      { id: 'single', schoolId: 'peakway', groupId: 'g1', date: '2026-08-15', startTime: '12:00', endTime: '13:00', billingType: 'single', createdAt: stamp, updatedAt: stamp },
    ];
    expect(countParticipantLessons(lessons, 'g1', '2026-08', '2026-08-31')).toEqual({ scheduled: 10, completed: 10, subscription: 9, single: 1 });
    expect(calculateAmountDue(9, 900, 1, 1200)).toBe(9300);
  });

  it('calculates payment status', () => {
    expect(getPaymentStatus(10000, 0)).toBe('unpaid');
    expect(getPaymentStatus(10000, 4000)).toBe('partial');
    expect(getPaymentStatus(10000, 10000)).toBe('paid');
  });
});
