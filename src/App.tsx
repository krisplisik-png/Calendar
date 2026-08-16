import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, Clock3, Plus, Search } from 'lucide-react';
import { DateTime } from 'luxon';
import { useAuth } from './auth/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { GroupDialog, type GroupInput } from './components/GroupDialog';
import { LessonDialog, type LessonInput } from './components/LessonDialog';
import { createGroup, createLesson, removeLesson, subscribeToGroups, subscribeToLessons, updateLesson } from './data/firestore';
import { humanizeFirebaseError } from './lib/errors';
import type { Group, Lesson } from './types';

type Zone = 'Asia/Yekaterinburg' | 'Europe/Moscow';

export function App() {
  const { firebaseUser, userProfile, loading, error: authError, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState<Zone>(() => (localStorage.getItem('calendar-zone') as Zone) || 'Asia/Yekaterinburg');
  const [now, setNow] = useState(DateTime.now());
  const [dataError, setDataError] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [initialDate, setInitialDate] = useState<string>();

  useEffect(() => { const timer = window.setInterval(() => setNow(DateTime.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => localStorage.setItem('calendar-zone', zone), [zone]);
  useEffect(() => {
    if (!userProfile) return;
    const handleError = (next: unknown) => setDataError(humanizeFirebaseError(next));
    const offGroups = subscribeToGroups(userProfile.schoolId, setGroups, handleError);
    const offLessons = subscribeToLessons(userProfile.schoolId, setLessons, handleError);
    return () => { offGroups(); offLessons(); };
  }, [userProfile]);

  const groupMap = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);
  const events = useMemo<EventInput[]>(() => lessons.filter(item => {
    const group = groupMap.get(item.groupId);
    const text = `${group?.name ?? ''} ${item.course ?? ''} ${item.topic ?? ''} ${item.homework ?? ''}`.toLocaleLowerCase('ru');
    return (!selectedGroups.size || selectedGroups.has(item.groupId)) && text.includes(search.toLocaleLowerCase('ru'));
  }).map(item => {
    const group = groupMap.get(item.groupId);
    return {
      id: item.id,
      title: `${group?.name ?? 'Без группы'}${item.topic ? ` · ${item.topic}` : ''}`,
      start: `${item.date}T${item.startTime}`,
      end: `${item.date}T${item.endTime}`,
      backgroundColor: group?.color ?? '#a98be8', borderColor: group?.color ?? '#a98be8',
      extendedProps: { lesson: item },
    };
  }), [lessons, groupMap, selectedGroups, search]);

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !userProfile) return <LoginPage authError={authError} />;
  if (userProfile.role !== 'admin') return <main className="access-denied"><h1>Раздел пока доступен только администратору</h1><button onClick={logout}>Выйти</button></main>;
  const profile = userProfile;

  const openNewLesson = (date?: string) => { setEditingLesson(null); setInitialDate(date); setLessonDialog(true); };
  const toggleGroup = (id: string) => setSelectedGroups(current => {
    const next = new Set(current);
    if (!next.size) groups.forEach(group => next.add(group.id));
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size === groups.length) next.clear();
    return next;
  });
  async function saveGroup(input: GroupInput) { await createGroup(profile.schoolId, input); }
  async function saveLesson(input: LessonInput) {
    if (input.endTime <= input.startTime) throw new Error('Время окончания должно быть позже начала.');
    if (editingLesson) await updateLesson(editingLesson.id, input);
    else await createLesson(profile.schoolId, input);
  }
  async function moveLesson(info: EventDropArg) {
    const start = info.event.start; const end = info.event.end;
    if (!start || !end) return info.revert();
    try { await updateLesson(info.event.id, { date: DateTime.fromJSDate(start).toFormat('yyyy-MM-dd'), startTime: DateTime.fromJSDate(start).toFormat('HH:mm'), endTime: DateTime.fromJSDate(end).toFormat('HH:mm') }); }
    catch { info.revert(); setDataError('Не удалось перенести занятие.'); }
  }
  async function resizeLesson(info: { event: EventDropArg['event']; revert: () => void }) {
    if (!info.event.end) return info.revert();
    try { await updateLesson(info.event.id, { endTime: DateTime.fromJSDate(info.event.end).toFormat('HH:mm') }); }
    catch { info.revert(); setDataError('Не удалось изменить длительность.'); }
  }

  return <div className="app-shell">
    <Sidebar profile={userProfile} groups={groups} selected={selectedGroups} onToggle={toggleGroup} onAddGroup={() => setGroupDialog(true)} onLogout={logout} />
    <main className="workspace">
      <header className="topbar">
        <div><p className="eyebrow">КАЛЕНДАРЬ ШКОЛЫ</p><h1>Расписание</h1></div>
        <div className="clocks"><Clock3 size={18} /><div><span>Пермь {now.setZone('Asia/Yekaterinburg').toFormat('HH:mm')}</span><small>Москва {now.setZone('Europe/Moscow').toFormat('HH:mm')}</small></div><button onClick={() => setZone(zone === 'Asia/Yekaterinburg' ? 'Europe/Moscow' : 'Asia/Yekaterinburg')} title="Сменить часовой пояс"><ChevronLeft size={15} /><ChevronRight size={15} /></button></div>
        <label className="search-box"><Search size={18} /><input placeholder="Поиск занятий" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <button className="primary-button" onClick={() => openNewLesson()}><Plus size={18} />Новое занятие</button>
      </header>
      {dataError && <div className="data-error" role="alert">{dataError}<button onClick={() => setDataError(null)}>×</button></div>}
      <section className="calendar-card">
        <div className="zone-caption">Расписание показано: {zone === 'Asia/Yekaterinburg' ? 'Пермь' : 'Москва'}</div>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={localStorage.getItem('calendar-view') || 'dayGridMonth'}
          locale="ru" firstDay={1} height="100%" timeZone={zone}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          buttonText={{ today: 'Сегодня', day: 'День', week: 'Неделя', month: 'Месяц' }}
          events={events} editable selectable nowIndicator dayMaxEvents
          slotMinTime="07:00:00" slotMaxTime="23:00:00" slotDuration="00:15:00"
          datesSet={arg => localStorage.setItem('calendar-view', arg.view.type)}
          dateClick={(arg: DateClickArg) => openNewLesson(arg.dateStr.slice(0, 10))}
          eventClick={(arg: EventClickArg) => { setEditingLesson(arg.event.extendedProps.lesson as Lesson); setLessonDialog(true); }}
          eventDrop={moveLesson}
          eventResize={resizeLesson}
        />
      </section>
    </main>
    {groupDialog && <GroupDialog onClose={() => setGroupDialog(false)} onSave={saveGroup} />}
    {lessonDialog && <LessonDialog groups={groups} lesson={editingLesson} initialDate={initialDate} onClose={() => setLessonDialog(false)} onSave={saveLesson} onDelete={editingLesson ? () => removeLesson(editingLesson.id) : undefined} />}
  </div>;
}
