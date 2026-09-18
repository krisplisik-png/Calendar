import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DateTime } from 'luxon';
import { getParentMonth, getParentView, getPublicLessonFeedback } from '../data/firestore';
import { summarizeHomeworkResults } from '../domain/lessonProgress';
import type { ParentLessonView, ParentMonthView, ParentView } from '../types';

interface ParentLessonFeedback {
  comment: string;
  homeworkDone?: boolean;
  homeworkAssigned?: boolean;
  homework?: string;
  nextHomeworkDate?: string;
  nextHomeworkAssigned?: boolean;
  nextHomework?: string;
}

async function loadParentLessonFeedback(lesson: ParentLessonView, studentId: string): Promise<ParentLessonFeedback> {
  const commentKey = lesson.commentKeyByStudentId?.[studentId] ?? '__general';
  const personal = await getPublicLessonFeedback(lesson.lessonId, lesson.occurrenceDate, commentKey);
  if (commentKey === '__general') return personal;
  const general = await getPublicLessonFeedback(lesson.lessonId, lesson.occurrenceDate, '__general');
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

export function ParentPage({ token }: { token: string }) {
  const [view, setView] = useState<ParentView | null>();
  const [monthData, setMonthData] = useState<ParentMonthView | null>();
  const [month, setMonth] = useState(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'));
  const [studentId, setStudentId] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<ParentLessonView | null>(null);
  const [parentComment, setParentComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [feedbackByLesson, setFeedbackByLesson] = useState<Record<string, ParentLessonFeedback>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setView(undefined); setError('');
    const load = async () => {
      let lastError = '';
      for (let attempt = 0; attempt < 8 && active; attempt += 1) {
        try {
          const data = await getParentView(token);
          if (data?.active && data.students.length) {
            if (!active) return;
            setView(data); setStudentId(data.students[0].id); return;
          }
        } catch (loadError) {
          lastError = loadError instanceof Error ? loadError.message : String(loadError);
        }
        await new Promise(resolve => window.setTimeout(resolve, 1500));
      }
      if (!active) return;
      setView(null);
      setError(lastError
        ? 'Эта старая персональная ссылка не была полностью сохранена или была отключена. Попросите администратора прислать готовую ссылку на расписание группы.'
        : 'Данные этой старой персональной ссылки не найдены. Попросите администратора прислать готовую ссылку на расписание группы.');
    };
    void load();
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (!view?.active) return;
    let active = true;
    const rootFallback = view.currentMonth === month && Array.isArray(view.currentLessons)
      ? { id: month, month, lessons: view.currentLessons } as ParentMonthView
      : null;
    setMonthData(rootFallback ?? undefined);
    const loadMonth = async () => {
      for (let attempt = 0; attempt < 6 && active; attempt += 1) {
        try {
          const data = await getParentMonth(token, month);
          if (data) { if (active) setMonthData(data); return; }
        } catch { /* The selected link may still be rebuilding. */ }
        await new Promise(resolve => window.setTimeout(resolve, 1200));
      }
      if (active && !rootFallback) setMonthData(null);
    };
    void loadMonth();
    return () => { active = false; };
  }, [token, month, view]);
  const lessons = useMemo(() => (monthData?.lessons ?? []).filter(item => !studentId || item.studentIds.includes(studentId)), [monthData, studentId]);
  useEffect(() => {
    let active = true;
    if (!studentId || !lessons.length) { setFeedbackByLesson({}); return () => { active = false; }; }
    setSummaryLoading(true);
    Promise.all(lessons.map(async lesson => {
      return [lesson.id, await loadParentLessonFeedback(lesson, studentId)] as const;
    })).then(items => { if (active) setFeedbackByLesson(Object.fromEntries(items)); }).catch(() => { if (active) setFeedbackByLesson({}); }).finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [lessons, studentId]);
  useEffect(() => { if (!selectedLesson) { setParentComment(''); return; } const cached = feedbackByLesson[selectedLesson.id]; if (cached) { setParentComment(cached.comment); setCommentLoading(false); return; } setCommentLoading(true); loadParentLessonFeedback(selectedLesson, studentId).then(feedback => setParentComment(feedback.comment)).catch(() => setParentComment('')).finally(() => setCommentLoading(false)); }, [selectedLesson, studentId, feedbackByLesson]);
  const lessonsByDate = useMemo(() => new Map(Array.from(new Set(lessons.map(item => item.date))).map(date => [date, lessons.filter(item => item.date === date)])), [lessons]);
  const cursor = DateTime.fromFormat(month, 'yyyy-MM', { zone: 'Asia/Yekaterinburg' });
  const firstCell = cursor.startOf('month').minus({ days: cursor.startOf('month').weekday - 1 });
  const cells = Array.from({ length: 42 }, (_, index) => firstCell.plus({ days: index }));
  const student = view?.students.find(item => item.id === studentId);
  const monthFinished = DateTime.now().setZone('Asia/Yekaterinburg').startOf('day') >= cursor.endOf('month').startOf('day');
  const homeworkSummary = summarizeHomeworkResults(lessons.map(lesson => feedbackByLesson[lesson.id]));
  const selectedFeedback = selectedLesson ? feedbackByLesson[selectedLesson.id] : undefined;

  if (view === undefined) return <main className="parent-state">Загружаем расписание…</main>;
  if (error || !view || !view.active) return <main className="parent-state"><div><h1>Ссылка недействительна</h1><p>{error || 'Попросите администратора школы прислать новую ссылку.'}</p></div></main>;
  return <main className="parent-page">
    <header className="parent-header"><div><p className="eyebrow">PEAKWAY</p><h1>Расписание {student?.fullName ?? ''}</h1><p>Занятия и домашние задания</p></div>{view.students.length > 1 && <div className="child-switcher">{view.students.map(item => <button className={item.id === studentId ? 'active' : ''} onClick={() => setStudentId(item.id)} key={item.id}>{item.fullName}</button>)}</div>}</header>
    <section className="parent-calendar-card">
      <div className="parent-month-nav"><button onClick={() => setMonth(cursor.minus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronLeft /></button><button onClick={() => setMonth(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'))}>Сегодня</button><h2>{cursor.setLocale('ru').toFormat('LLLL yyyy')}</h2><button onClick={() => setMonth(cursor.plus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronRight /></button></div>
      <div className="parent-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="parent-month-grid">{cells.map(day => {
        const date = day.toFormat('yyyy-MM-dd'); const dayLessons = lessonsByDate.get(date) ?? [];
        return <article className={`${day.month !== cursor.month ? 'outside' : ''} ${date === DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM-dd') ? 'today' : ''}`} key={date}><span>{day.day}</span>{dayLessons.map(item => <button onClick={() => setSelectedLesson(item)} key={item.id}><strong>{item.startTime}{item.room ? ` · Каб. ${item.room}` : ''}</strong>{item.course || item.groupName || 'Занятие'}</button>)}</article>;
      })}</div>
      {monthData === undefined && <div className="parent-loading">Загружаем месяц…</div>}
      {monthFinished && <div className="parent-homework-summary"><div><span>Итоги месяца</span><strong>Домашние задания</strong></div><b>{summaryLoading ? 'Считаем…' : `${homeworkSummary.done} из ${homeworkSummary.total} выполнено`}</b></div>}
    </section>
    {selectedLesson && <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelectedLesson(null)}><section className="dialog parent-lesson-dialog"><header><div><p className="eyebrow">ЗАНЯТИЕ</p><h2>{selectedLesson.course || selectedLesson.groupName || 'Занятие'}</h2></div><button onClick={() => setSelectedLesson(null)}><X /></button></header><dl><div><dt>Дата и время</dt><dd>{DateTime.fromISO(selectedLesson.date).setLocale('ru').toFormat('d LLLL yyyy')} · {selectedLesson.startTime}–{selectedLesson.endTime}</dd></div>{selectedLesson.room && <div><dt>Кабинет</dt><dd>Кабинет {selectedLesson.room}</dd></div>}{selectedLesson.groupName && <div><dt>Группа</dt><dd>{selectedLesson.groupName}</dd></div>}{selectedLesson.teacherName && <div><dt>Преподаватель</dt><dd>{selectedLesson.teacherName}</dd></div>}{selectedLesson.topic && <div><dt>Тема</dt><dd>{selectedLesson.topic}</dd></div>}<div><dt>{selectedFeedback?.nextHomeworkDate ? `Домашнее задание на ${DateTime.fromISO(selectedFeedback.nextHomeworkDate).setLocale('ru').toFormat('d LLLL')}` : 'Домашнее задание на следующее занятие'}</dt><dd>{summaryLoading && !selectedFeedback ? 'Загружаем…' : selectedFeedback?.nextHomeworkAssigned === false ? 'Не задавалось' : selectedFeedback?.nextHomework || 'Домашнее задание пока не указано.'}{selectedFeedback?.homeworkAssigned === true && <small className={selectedFeedback.homeworkDone ? 'homework-done' : 'homework-missing'}>Домашнее к {DateTime.fromISO(selectedLesson.date).setLocale('ru').toFormat('d LLLL')}: {selectedFeedback.homeworkDone ? 'выполнено' : 'не выполнено'}</small>}</dd></div><div className="parent-comment"><dt>Комментарий учителя</dt><dd>{commentLoading ? 'Загружаем…' : parentComment || 'Комментариев к этому уроку пока нет.'}</dd></div></dl><footer><button className="primary-button" onClick={() => setSelectedLesson(null)}>Закрыть</button></footer></section></div>}
  </main>;
}
