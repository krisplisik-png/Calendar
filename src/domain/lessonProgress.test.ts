import { describe, expect, it } from 'vitest';
import type { Lesson } from '../types';
import { HOMEWORK_DATE_KEY, homeworkCanBeGraded, homeworkForGroupOccurrence, homeworkForOccurrence, homeworkFromPublicFeedback, nextGroupLessonOccurrence, nextLessonOccurrenceDate, summarizeHomeworkResults } from './lessonProgress';

describe('lesson occurrence homework', () => {
  it('keeps homework only on the saved date of a recurring lesson', () => {
    const lesson = {
      homework: 'Старое общее задание',
      recurrenceWeekdays: [3],
      recurrenceUntil: '2026-12-31',
      parentCommentByDate: {
        '2026-09-10': { [HOMEWORK_DATE_KEY]: 'Упражнение 5' },
      },
    };

    expect(homeworkForOccurrence(lesson, '2026-09-10')).toBe('Упражнение 5');
    expect(homeworkForOccurrence(lesson, '2026-09-17')).toBe('');
  });

  it('does not repeat legacy series-wide homework on future dates', () => {
    expect(homeworkForOccurrence({
      homework: 'Старое общее задание',
      recurrenceWeekdays: [4],
      recurrenceUntil: '2026-12-31',
    }, '2026-09-17')).toBe('');
  });

  it('keeps the original homework for a one-time lesson', () => {
    expect(homeworkForOccurrence({ homework: 'Упражнение 7' }, '2026-09-10')).toBe('Упражнение 7');
  });

  it('finds the next actual occurrence in a multi-day group schedule', () => {
    const lesson = {
      date: '2026-09-14',
      recurrenceWeekdays: [1, 4],
      recurrenceUntil: '2026-10-01',
      excludedDates: [],
    };

    expect(nextLessonOccurrenceDate(lesson, '2026-09-14')).toBe('2026-09-17');
    expect(nextLessonOccurrenceDate(lesson, '2026-09-17')).toBe('2026-09-21');
  });

  it('skips an excluded next occurrence', () => {
    expect(nextLessonOccurrenceDate({
      date: '2026-09-14',
      recurrenceWeekdays: [1, 4],
      recurrenceUntil: '2026-10-01',
      excludedDates: ['2026-09-17'],
    }, '2026-09-14')).toBe('2026-09-21');
  });

  it('finds the next group lesson even when weekdays are stored in separate series', () => {
    const lessons = [
      { id: 'tuesday', groupId: 'gg2', date: '2026-09-01', startTime: '16:00', recurrenceWeekdays: [2], recurrenceUntil: '2026-09-30' },
      { id: 'thursday', groupId: 'gg2', date: '2026-09-03', startTime: '16:00', recurrenceWeekdays: [4], recurrenceUntil: '2026-09-30' },
    ] as Lesson[];

    const next = nextGroupLessonOccurrence(lessons, 'gg2', '2026-09-15', 'tuesday', '16:00');
    expect(next?.lesson.id).toBe('thursday');
    expect(next?.occurrenceDate).toBe('2026-09-17');
  });

  it('finds homework saved by a previous series for the next group lesson', () => {
    const lessons = [
      { id: 'source', groupId: 'gg2', date: '2026-09-15', startTime: '16:00', recurrenceWeekdays: [2], recurrenceUntil: '2026-09-30', parentCommentByDate: { '2026-09-17': { [HOMEWORK_DATE_KEY]: 'Страница 12' } } },
      { id: 'target', groupId: 'gg2', date: '2026-09-17', startTime: '16:00', recurrenceWeekdays: [4], recurrenceUntil: '2026-09-30' },
    ] as Lesson[];

    expect(homeworkForGroupOccurrence(lessons, 'gg2', '2026-09-17', 'target')).toBe('Страница 12');
  });

  it('keeps homework isolated on every future weekly occurrence', () => {
    const lessons = [{
      id: 'monday-15', groupId: 'weekly-group', date: '2026-09-07', startTime: '15:00',
      recurrenceWeekdays: [1], recurrenceUntil: '2026-10-31',
      parentCommentByDate: {
        '2026-09-14': { [HOMEWORK_DATE_KEY]: 'Task for 14 September' },
        '2026-09-21': { [HOMEWORK_DATE_KEY]: 'Task for 21 September' },
      },
    }] as unknown as Lesson[];

    expect(homeworkForGroupOccurrence(lessons, 'weekly-group', '2026-09-14', 'monday-15')).toBe('Task for 14 September');
    expect(homeworkForGroupOccurrence(lessons, 'weekly-group', '2026-09-21', 'monday-15')).toBe('Task for 21 September');
    expect(homeworkForGroupOccurrence(lessons, 'weekly-group', '2026-09-28', 'monday-15')).toBe('');
    expect(nextGroupLessonOccurrence(lessons, 'weekly-group', '2026-09-14', 'monday-15', '15:00')?.occurrenceDate).toBe('2026-09-21');
  });
});

describe('homework grading and totals', () => {
  it('allows grading when homework text was added after an old not-assigned status', () => {
    expect(homeworkCanBeGraded('Page 12', { homeworkAssigned: false, homeworkDone: false })).toBe(true);
    expect(homeworkCanBeGraded('', { homeworkAssigned: false, homeworkDone: false })).toBe(false);
  });

  it('recovers homework stored in an exact-date legacy public record', () => {
    expect(homeworkFromPublicFeedback({ homework: '  Exercise 7  ' })).toBe('Exercise 7');
    expect(homeworkFromPublicFeedback(undefined)).toBe('');
  });

  it('counts only assigned homework in the parent result', () => {
    expect(summarizeHomeworkResults([
      { homeworkAssigned: true, homeworkDone: true },
      { homeworkAssigned: true, homeworkDone: false },
      { homeworkAssigned: false, homeworkDone: false },
      undefined,
    ])).toEqual({ done: 1, total: 2 });
  });
});
