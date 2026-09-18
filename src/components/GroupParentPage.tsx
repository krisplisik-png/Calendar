import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DateTime } from 'luxon';
import { getPublicLessonFeedback, subscribeToPublicGroupLessons } from '../data/firestore';
import { expandLessonOccurrences } from '../domain/recurrence';
import { summarizeHomeworkResults } from '../domain/lessonProgress';
import type { Lesson, PublicGroupLesson } from '../types';

interface SelectedGroupLesson {
  lesson: PublicGroupLesson;
  occurrenceDate: string;
}

interface PublicLessonFeedback {
  comment: string;
  homeworkDone?: boolean;
  homeworkAssigned?: boolean;
  homework?: string;
  nextHomeworkDate?: string;
  nextHomeworkAssigned?: boolean;
  nextHomework?: string;
}

async function loadStudentFeedback(lessonId: string, occurrenceDate: string, studentId: string): Promise<PublicLessonFeedback> {
  const personal = studentId
    ? await getPublicLessonFeedback(lessonId, occurrenceDate, studentId)
    : { comment: '' };
  const general = await getPublicLessonFeedback(lessonId, occurrenceDate, '__general');
  return {
    comment: personal.comment || general.comment,
    homeworkDone: personal.homeworkDone,
    homeworkAssigned: personal.homeworkAssigned ?? general.homeworkAssigned,
    homework: personal.homework ?? general.homework,
    nextHomeworkDate: personal.nextHomeworkDate ?? general.nextHomeworkDate,
    nextHomeworkAssigned: personal.nextHomeworkAssigned ?? general.nextHomeworkAssigned,
    nextHomework: personal.nextHomework ?? general.nextHomework,
  };
}

export function GroupParentPage({ groupId, studentId, studentName, groupName }: { groupId: string; studentId: string; studentName: string; groupName: string }) {
  const [lessons, setLessons] = useState<PublicGroupLesson[]>();
  const [month, setMonth] = useState(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'));
  const [selected, setSelected] = useState<SelectedGroupLesson | null>(null);
  const [feedback, setFeedback] = useState<PublicLessonFeedback>({ comment: '' });
  const [feedbackByOccurrence, setFeedbackByOccurrence] = useState<Record<string, PublicLessonFeedback>>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLessons(undefined);
    setError('');
    return subscribeToPublicGroupLessons(groupId, data => {
      setLessons(data);
      setError('');
    }, loadError => {
      setLessons([]);
      setError(loadError.message);
    });
  }, [groupId]);

  const occurrences = useMemo(() => (lessons ?? []).flatMap(lesson =>
    expandLessonOccurrences(lesson as unknown as Lesson).map(item => ({ lesson, occurrenceDate: item.occurrenceDate })),
  ).filter(item => item.occurrenceDate.startsWith(month)), [lessons, month]);
  const byDate = useMemo(() => new Map(Array.from(new Set(occurrences.map(item => item.occurrenceDate))).map(date => [date, occurrences.filter(item => item.occurrenceDate === date)])), [occurrences]);
  const cursor = DateTime.fromFormat(month, 'yyyy-MM', { zone: 'Asia/Yekaterinburg' });
  const firstCell = cursor.startOf('month').minus({ days: cursor.startOf('month').weekday - 1 });
  const cells = Array.from({ length: 42 }, (_, index) => firstCell.plus({ days: index }));
  const displayedGroupName = lessons?.find(item => item.groupName)?.groupName || groupName || 'Группа';

  useEffect(() => {
    let active = true;
    if (!occurrences.length) { setFeedbackByOccurrence({}); return () => { active = false; }; }
    setSummaryLoading(true);
    Promise.all(occurrences.map(async item => {
      const key = `${item.lesson.id}__${item.occurrenceDate}`;
      return [key, await loadStudentFeedback(item.lesson.id, item.occurrenceDate, studentId)] as const;
    })).then(items => { if (active) setFeedbackByOccurrence(Object.fromEntries(items)); })
      .catch(() => { if (active) setFeedbackByOccurrence({}); })
      .finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [occurrences, studentId]);

  useEffect(() => {
    if (!selected) { setFeedback({ comment: '' }); return; }
    let active = true;
    setFeedback({ comment: '' });
    setFeedbackLoading(true);
    const load = async () => {
      const loaded = await loadStudentFeedback(selected.lesson.id, selected.occurrenceDate, studentId);
      if (active) setFeedback(loaded);
    };
    load().catch(() => { if (active) setFeedback({ comment: '' }); }).finally(() => { if (active) setFeedbackLoading(false); });
    return () => { active = false; };
  }, [selected, studentId]);

  const monthFinished = DateTime.now().setZone('Asia/Yekaterinburg').startOf('day') >= cursor.endOf('month').startOf('day');
  const homeworkSummary = summarizeHomeworkResults(occurrences.map(item =>
    feedbackByOccurrence[`${item.lesson.id}__${item.occurrenceDate}`],
  ));

  if (lessons === undefined) return <main className="parent-state">Загружаем расписание группы…</main>;
  return <main className="parent-page">
    <header className="parent-header"><div><p className="eyebrow">PEAKWAY</p><h1>Расписание {studentName}</h1><p>{displayedGroupName}</p></div></header>
    <section className="parent-calendar-card">
      <div className="parent-month-nav"><button onClick={() => setMonth(cursor.minus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronLeft /></button><button onClick={() => setMonth(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'))}>Сегодня</button><h2>{cursor.setLocale('ru').toFormat('LLLL yyyy')}</h2><button onClick={() => setMonth(cursor.plus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronRight /></button></div>
      <div className="parent-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="parent-month-grid">{cells.map(day => {
        const date = day.toFormat('yyyy-MM-dd'); const dayLessons = byDate.get(date) ?? [];
        return <article className={`${day.month !== cursor.month ? 'outside' : ''} ${date === DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM-dd') ? 'today' : ''}`} key={date}><span>{day.day}</span>{dayLessons.map(item => <button onClick={() => setSelected(item)} key={`${item.lesson.id}-${date}`}><strong>{item.lesson.startTime}{item.lesson.room ? ` · Каб. ${item.lesson.room}` : ''}</strong>{item.lesson.course || item.lesson.groupName || 'Занятие'}</button>)}</article>;
      })}</div>
      {!occurrences.length && <div className="simple-parent-empty">{error ? `Не удалось загрузить расписание: ${error}` : 'В этом месяце занятий группы пока нет.'}</div>}
      {monthFinished && <div className="parent-homework-summary"><div><span>Итоги месяца</span><strong>Домашние задания</strong></div><b>{summaryLoading ? 'Считаем…' : `${homeworkSummary.done} из ${homeworkSummary.total} выполнено`}</b></div>}
    </section>
    {selected && <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="dialog parent-lesson-dialog"><header><div><p className="eyebrow">ЗАНЯТИЕ</p><h2>{selected.lesson.course || selected.lesson.groupName || 'Занятие'}</h2></div><button onClick={() => setSelected(null)}><X /></button></header><dl><div><dt>Дата и время</dt><dd>{DateTime.fromISO(selected.occurrenceDate).setLocale('ru').toFormat('d LLLL yyyy')} · {selected.lesson.startTime}–{selected.lesson.endTime}</dd></div>{selected.lesson.room && <div><dt>Кабинет</dt><dd>Кабинет {selected.lesson.room}</dd></div>}<div><dt>Группа</dt><dd>{selected.lesson.groupName || displayedGroupName}</dd></div>{selected.lesson.teacherName && <div><dt>Преподаватель</dt><dd>{selected.lesson.teacherName}</dd></div>}{selected.lesson.unit && <div><dt>Раздел</dt><dd>{selected.lesson.unit}</dd></div>}{selected.lesson.lesson && <div><dt>Урок</dt><dd>{selected.lesson.lesson}</dd></div>}{selected.lesson.topic && <div><dt>Тема</dt><dd>{selected.lesson.topic}</dd></div>}<div><dt>{feedback.nextHomeworkDate ? `Домашнее задание на ${DateTime.fromISO(feedback.nextHomeworkDate).setLocale('ru').toFormat('d LLLL')}` : 'Домашнее задание на следующее занятие'}</dt><dd>{feedbackLoading ? 'Загружаем…' : feedback.nextHomeworkAssigned === false ? 'Не задавалось' : feedback.nextHomework || 'Домашнее задание пока не указано.'}{feedback.homeworkAssigned === true && <small className={feedback.homeworkDone ? 'homework-done' : 'homework-missing'}>Домашнее к {DateTime.fromISO(selected.occurrenceDate).setLocale('ru').toFormat('d LLLL')}: {feedback.homeworkDone ? 'выполнено' : 'не выполнено'}</small>}</dd></div><div className="parent-comment"><dt>Комментарий учителя</dt><dd>{feedbackLoading ? 'Загружаем…' : feedback.comment || 'Комментариев к этому уроку пока нет.'}</dd></div></dl><footer><button className="primary-button" onClick={() => setSelected(null)}>Закрыть</button></footer></section></div>}
  </main>;
}
