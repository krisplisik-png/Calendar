import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DateTime } from 'luxon';
import { getParentMonth, getParentView } from '../data/firestore';
import type { ParentLessonView, ParentMonthView, ParentView } from '../types';

export function ParentPage({ token }: { token: string }) {
  const [view, setView] = useState<ParentView | null>();
  const [monthData, setMonthData] = useState<ParentMonthView | null>();
  const [month, setMonth] = useState(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'));
  const [studentId, setStudentId] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<ParentLessonView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getParentView(token).then(data => { setView(data); if (data?.students[0]) setStudentId(data.students[0].id); }).catch(() => setError('Не удалось загрузить расписание.')); }, [token]);
  useEffect(() => { if (!view?.active) return; setMonthData(undefined); getParentMonth(token, month).then(setMonthData).catch(() => setError('Не удалось загрузить выбранный месяц.')); }, [token, month, view]);
  const lessons = useMemo(() => (monthData?.lessons ?? []).filter(item => !studentId || item.studentIds.includes(studentId)), [monthData, studentId]);
  const lessonsByDate = useMemo(() => new Map(Array.from(new Set(lessons.map(item => item.date))).map(date => [date, lessons.filter(item => item.date === date)])), [lessons]);
  const cursor = DateTime.fromFormat(month, 'yyyy-MM', { zone: 'Asia/Yekaterinburg' });
  const firstCell = cursor.startOf('month').minus({ days: cursor.startOf('month').weekday - 1 });
  const cells = Array.from({ length: 42 }, (_, index) => firstCell.plus({ days: index }));
  const student = view?.students.find(item => item.id === studentId);

  if (view === undefined) return <main className="parent-state">Загружаем расписание…</main>;
  if (error || !view || !view.active) return <main className="parent-state"><div><h1>Ссылка недействительна</h1><p>{error || 'Попросите администратора школы прислать новую ссылку.'}</p></div></main>;
  return <main className="parent-page">
    <header className="parent-header"><div><p className="eyebrow">PEAKWAY</p><h1>Расписание {student?.fullName ?? ''}</h1><p>Занятия и домашние задания</p></div>{view.students.length > 1 && <div className="child-switcher">{view.students.map(item => <button className={item.id === studentId ? 'active' : ''} onClick={() => setStudentId(item.id)} key={item.id}>{item.fullName}</button>)}</div>}</header>
    <section className="parent-calendar-card">
      <div className="parent-month-nav"><button onClick={() => setMonth(cursor.minus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronLeft /></button><button onClick={() => setMonth(DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM'))}>Сегодня</button><h2>{cursor.setLocale('ru').toFormat('LLLL yyyy')}</h2><button onClick={() => setMonth(cursor.plus({ months: 1 }).toFormat('yyyy-MM'))}><ChevronRight /></button></div>
      <div className="parent-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="parent-month-grid">{cells.map(day => {
        const date = day.toFormat('yyyy-MM-dd'); const dayLessons = lessonsByDate.get(date) ?? [];
        return <article className={`${day.month !== cursor.month ? 'outside' : ''} ${date === DateTime.now().setZone('Asia/Yekaterinburg').toFormat('yyyy-MM-dd') ? 'today' : ''}`} key={date}><span>{day.day}</span>{dayLessons.map(item => <button onClick={() => setSelectedLesson(item)} key={item.id}><strong>{item.startTime}</strong>{item.course || item.groupName || 'Занятие'}</button>)}</article>;
      })}</div>
      {monthData === undefined && <div className="parent-loading">Загружаем месяц…</div>}
    </section>
    {selectedLesson && <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelectedLesson(null)}><section className="dialog parent-lesson-dialog"><header><div><p className="eyebrow">ЗАНЯТИЕ</p><h2>{selectedLesson.course || selectedLesson.groupName || 'Занятие'}</h2></div><button onClick={() => setSelectedLesson(null)}><X /></button></header><dl><div><dt>Дата и время</dt><dd>{DateTime.fromISO(selectedLesson.date).setLocale('ru').toFormat('d LLLL yyyy')} · {selectedLesson.startTime}–{selectedLesson.endTime}</dd></div>{selectedLesson.groupName && <div><dt>Группа</dt><dd>{selectedLesson.groupName}</dd></div>}{selectedLesson.teacherName && <div><dt>Преподаватель</dt><dd>{selectedLesson.teacherName}</dd></div>}{selectedLesson.topic && <div><dt>Тема</dt><dd>{selectedLesson.topic}</dd></div>}{selectedLesson.homework && <div><dt>Домашнее задание</dt><dd>{selectedLesson.homework}</dd></div>}</dl><footer><button className="primary-button" onClick={() => setSelectedLesson(null)}>Закрыть</button></footer></section></div>}
  </main>;
}
