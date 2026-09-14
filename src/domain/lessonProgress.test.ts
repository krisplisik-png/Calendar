import { describe, expect, it } from 'vitest';
import { HOMEWORK_DATE_KEY, homeworkForOccurrence } from './lessonProgress';

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
});
