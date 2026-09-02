import { DateTime } from 'luxon';
import type { Group, Lesson, ParentLessonView, SchoolUser, Student } from '../types';
import { expandLessonOccurrences } from './recurrence';

export function generateParentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function parentMonthKeys(from = DateTime.now().setZone('Asia/Yekaterinburg'), count = 12): string[] {
  return Array.from({ length: count }, (_, index) => from.startOf('month').plus({ months: index }).toFormat('yyyy-MM'));
}

export function buildParentLessons(
  studentIds: string[], students: Student[], groups: Group[], lessons: Lesson[], teachers: SchoolUser[], months: string[],
): Record<string, ParentLessonView[]> {
  const allowedStudents = students.filter(student => studentIds.includes(student.id) && student.active !== false);
  const groupMap = new Map(groups.map(group => [group.id, group]));
  const teacherMap = new Map(teachers.map(teacher => [teacher.id, teacher.name]));
  const result = Object.fromEntries(months.map(month => [month, [] as ParentLessonView[]]));

  for (const item of lessons) {
    const linked = allowedStudents.filter(student => student.groupIds.includes(item.groupId)).map(student => student.id);
    if (!linked.length) continue;
    const group = groupMap.get(item.groupId);
    for (const occurrence of expandLessonOccurrences(item)) {
      const month = occurrence.occurrenceDate.slice(0, 7);
      if (!result[month]) continue;
      const publicLesson: ParentLessonView = {
        id: `${item.id}__${occurrence.occurrenceDate}`,
        lessonId: item.id,
        occurrenceDate: occurrence.occurrenceDate,
        studentIds: linked,
        date: occurrence.occurrenceDate,
        startTime: item.startTime,
        endTime: item.endTime,
        status: occurrence.occurrenceDate < DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM-dd') ? 'completed' : 'scheduled',
        ...(group?.name ? { groupName: group.name } : {}),
        ...(item.course || group?.course ? { course: item.course || group?.course } : {}),
        ...(item.teacherId && teacherMap.get(item.teacherId) ? { teacherName: teacherMap.get(item.teacherId) } : {}),
        ...(item.unit ? { unit: item.unit } : {}),
        ...(item.lesson ? { lesson: item.lesson } : {}),
        ...(item.topic ? { topic: item.topic } : {}),
        ...(item.homework ? { homework: item.homework } : {}),
        ...(item.room ? { room: item.room } : {}),
      };
      result[month].push(publicLesson);
    }
  }
  for (const month of months) result[month].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  return result;
}
