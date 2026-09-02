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
import { createGroup, createLesson, publishPublicLesson, removeGroup, removeLesson, removePublicLesson, setGroupTeacher, setLessonTeacher, subscribeToGroups, subscribeToLessons, subscribeToTeachers, updateLesson } from './data/firestore';
import { humanizeFirebaseError } from './lib/errors';
import type { Group, Lesson, SchoolUser } from './types';
import { expandLessonOccurrences } from './domain/recurrence';
import { PaymentsPage } from './components/PaymentsPage';
import { TeacherAssignmentsDialog } from './components/TeacherAssignmentsDialog';
import { ParentAccessDialog } from './components/ParentAccessDialog';
import { ParentPage } from './components/ParentPage';
import { createParentLink, createStudent, disableParentLink, rebuildParentViewsForSchool, regenerateParentLink, subscribeToParentAccess, subscribeToStudents } from './data/firestore';
import type { ParentAccess, Student } from './types';

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
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<string>();
  const [activeView, setActiveView] = useState<'calendar' | 'payments'>('calendar');
  const [teachers, setTeachers] = useState<SchoolUser[]>([]);
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [parentAccess, setParentAccess] = useState<ParentAccess[]>([]);
  const [parentDialog, setParentDialog] = useState(false);
  const parentToken = new URLSearchParams(window.location.search).get('parent')?.trim() ?? '';

  useEffect(() => { const timer = window.setInterval(() => setNow(DateTime.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => localStorage.setItem('calendar-zone', zone), [zone]);
  useEffect(() => {
    if (!userProfile) return;
    const handleError = (next: unknown) => setDataError(humanizeFirebaseError(next));
    const teacherId = userProfile.role === 'teacher' ? firebaseUser?.uid : undefined;
    const offGroups = subscribeToGroups(userProfile.schoolId, setGroups, handleError, teacherId);
    const offLessons = subscribeToLessons(userProfile.schoolId, setLessons, handleError, teacherId);
    const offTeachers = ['owner', 'admin'].includes(userProfile.role) ? subscribeToTeachers(userProfile.schoolId, setTeachers, handleError) : () => undefined;
    const offStudents = ['owner', 'admin'].includes(userProfile.role) ? subscribeToStudents(userProfile.schoolId, setStudents, handleError) : () => undefined;
    const offParentAccess = ['owner', 'admin'].includes(userProfile.role) ? subscribeToParentAccess(userProfile.schoolId, setParentAccess, handleError) : () => undefined;
    return () => { offGroups(); offLessons(); offTeachers(); offStudents(); offParentAccess(); };
  }, [userProfile, firebaseUser]);

  const groupMap = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);
  const events = useMemo<EventInput[]>(() => lessons.filter(item => {
    const group = groupMap.get(item.groupId);
    const text = `${group?.name ?? ''} ${item.course ?? ''} ${item.topic ?? ''} ${item.homework ?? ''} ${item.room ? `кабинет ${item.room}` : ''}`.toLocaleLowerCase('ru');
    return (!selectedGroups.size || selectedGroups.has(item.groupId)) && text.includes(search.toLocaleLowerCase('ru'));
  }).flatMap(item => expandLessonOccurrences(item).map(({ occurrenceDate }) => {
    const group = groupMap.get(item.groupId);
    const recurring = Boolean(item.recurrenceWeekdays?.length && item.recurrenceUntil);
    return {
      id: recurring ? `${item.id}__${occurrenceDate}` : item.id,
      title: `${group?.name ?? 'Без группы'}${item.room ? ` · Каб. ${item.room}` : ''}${item.topic ? ` · ${item.topic}` : ''}`,
      start: `${occurrenceDate}T${item.startTime}`,
      end: `${occurrenceDate}T${item.endTime}`,
      backgroundColor: group?.color ?? '#a98be8', borderColor: group?.color ?? '#a98be8',
      editable: !recurring,
      extendedProps: { lesson: item, occurrenceDate },
    };
  })), [lessons, groupMap, selectedGroups, search]);

  if (parentToken) return <ParentPage token={parentToken} />;
  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !userProfile) return <LoginPage authError={authError} />;
  const profile = userProfile;
  const canManage = ['owner', 'admin'].includes(profile.role);
  const teacherMode = profile.role === 'teacher';
  if (!canManage && !teacherMode) return <main className="access-denied"><h1>Для вашей роли интерфейс пока не настроен</h1><button onClick={logout}>Выйти</button></main>;

  const openNewLesson = (date?: string) => { setEditingLesson(null); setEditingOccurrenceDate(null); setInitialDate(date); setLessonDialog(true); };
  const toggleGroup = (id: string) => setSelectedGroups(current => {
    const next = new Set(current);
    if (!next.size) groups.forEach(group => next.add(group.id));
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size === groups.length) next.clear();
    return next;
  });
  async function refreshParentViews() { if (canManage) await rebuildParentViewsForSchool(profile.schoolId); }
  async function saveGroup(input: GroupInput) { await createGroup(profile.schoolId, input); await refreshParentViews(); }
  async function deleteGroup(group: Group) {
    try {
      await removeGroup(group.id);
      await refreshParentViews();
      setSelectedGroups(current => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
    } catch (nextError) {
      setDataError(humanizeFirebaseError(nextError));
      throw nextError;
    }
  }
  async function saveLesson(input: LessonInput) {
    if (input.endTime <= input.startTime) throw new Error('Время окончания должно быть позже начала.');
    if (input.recurrenceUntil && input.recurrenceUntil < input.date) throw new Error('Дата окончания повторения не может быть раньше первого занятия.');
    const { students, ...lessonFields } = input;
    const statusDate = editingOccurrenceDate ?? input.date;
    const studentRoster = students.map(student => ({ id: student.id, fullName: student.fullName.trim() })).filter(student => student.fullName);
    const dateStatuses = Object.fromEntries(students.filter(student => student.fullName.trim()).map(student => [student.id, { attended: student.attended, homeworkDone: student.homeworkDone }]));
    const studentStatusByDate = { ...(editingLesson?.studentStatusByDate ?? {}), [statusDate]: dateStatuses };
    if (teacherMode && editingLesson) {
      await updateLesson(editingLesson.id, { homework: input.homework, notes: input.notes, studentRoster, studentStatusByDate });
      return;
    }
    const assignedTeacherId = groups.find(group => group.id === input.groupId)?.teacherId;
    const selectedGroup = groups.find(group => group.id === input.groupId);
    const payload = {
      ...lessonFields,
      ...(assignedTeacherId ? { teacherId: assignedTeacherId } : {}),
      studentRoster,
      studentStatusByDate,
    };
    if (editingLesson) {
      await updateLesson(editingLesson.id, payload);
      await publishPublicLesson(editingLesson.id, profile.schoolId, { ...editingLesson, ...payload }, selectedGroup);
    } else {
      const created = await createLesson(profile.schoolId, payload);
      await publishPublicLesson(created.id, profile.schoolId, payload, selectedGroup);
    }
    await refreshParentViews();
  }
  async function assignTeacher(group: Group, teacherId: string) {
    try {
      await setGroupTeacher(group.id, teacherId);
      await Promise.all(lessons.filter(lesson => lesson.groupId === group.id).map(lesson => setLessonTeacher(lesson.id, teacherId)));
      await refreshParentViews();
    } catch (error) {
      setDataError(humanizeFirebaseError(error));
    }
  }
  async function deleteLesson(scope: 'occurrence' | 'series') {
    if (!editingLesson) return;
    if (scope === 'occurrence' && editingOccurrenceDate && editingLesson.recurrenceWeekdays?.length) {
      const excludedDates = Array.from(new Set([...(editingLesson.excludedDates ?? []), editingOccurrenceDate])).sort();
      await updateLesson(editingLesson.id, { excludedDates });
      await publishPublicLesson(editingLesson.id, profile.schoolId, { ...editingLesson, excludedDates }, groups.find(group => group.id === editingLesson.groupId));
      await refreshParentViews();
      return;
    }
    await removeLesson(editingLesson.id);
    await removePublicLesson(editingLesson.id);
    await refreshParentViews();
  }
  async function moveLesson(info: EventDropArg) {
    const start = info.event.start; const end = info.event.end;
    if (!start || !end) return info.revert();
    try { const patch = { date: DateTime.fromJSDate(start).toFormat('yyyy-MM-dd'), startTime: DateTime.fromJSDate(start).toFormat('HH:mm'), endTime: DateTime.fromJSDate(end).toFormat('HH:mm') }; const lesson = info.event.extendedProps.lesson as Lesson; await updateLesson(info.event.id, patch); await publishPublicLesson(info.event.id, profile.schoolId, { ...lesson, ...patch }, groups.find(group => group.id === lesson.groupId)); await refreshParentViews(); }
    catch { info.revert(); setDataError('Не удалось перенести занятие.'); }
  }
  async function resizeLesson(info: { event: EventDropArg['event']; revert: () => void }) {
    if (!info.event.end) return info.revert();
    try { const patch = { endTime: DateTime.fromJSDate(info.event.end).toFormat('HH:mm') }; const lesson = info.event.extendedProps.lesson as Lesson; await updateLesson(info.event.id, patch); await publishPublicLesson(info.event.id, profile.schoolId, { ...lesson, ...patch }, groups.find(group => group.id === lesson.groupId)); await refreshParentViews(); }
    catch { info.revert(); setDataError('Не удалось изменить длительность.'); }
  }

  return <div className="app-shell">
    <Sidebar profile={userProfile} groups={groups} selected={selectedGroups} onToggle={toggleGroup} onAddGroup={() => setGroupDialog(true)} onDeleteGroup={deleteGroup} activeView={activeView} onNavigate={setActiveView} canManage={canManage} onManageTeachers={() => setTeacherDialog(true)} onManageParents={() => setParentDialog(true)} onLogout={logout} />
    <main className="workspace">
      {activeView === 'payments' ? <PaymentsPage profile={profile} groups={groups} lessons={lessons} onError={setDataError} /> : <>
      <header className="topbar">
        <div><p className="eyebrow">КАЛЕНДАРЬ ШКОЛЫ</p><h1>Расписание</h1></div>
        <div className="clocks"><Clock3 size={18} /><div><span>Пермь {now.setZone('Asia/Yekaterinburg').toFormat('HH:mm')}</span><small>Москва {now.setZone('Europe/Moscow').toFormat('HH:mm')}</small></div><button onClick={() => setZone(zone === 'Asia/Yekaterinburg' ? 'Europe/Moscow' : 'Asia/Yekaterinburg')} title="Сменить часовой пояс"><ChevronLeft size={15} /><ChevronRight size={15} /></button></div>
        <label className="search-box"><Search size={18} /><input placeholder="Поиск занятий" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {canManage && <button className="primary-button" onClick={() => openNewLesson()}><Plus size={18} />Новое занятие</button>}
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
          events={events} editable={canManage} selectable={canManage} nowIndicator dayMaxEvents
          slotMinTime="07:00:00" slotMaxTime="23:00:00" slotDuration="00:15:00"
          datesSet={arg => localStorage.setItem('calendar-view', arg.view.type)}
          dateClick={(arg: DateClickArg) => { if (canManage) openNewLesson(arg.dateStr.slice(0, 10)); }}
          eventClick={(arg: EventClickArg) => { setEditingLesson(arg.event.extendedProps.lesson as Lesson); setEditingOccurrenceDate(arg.event.extendedProps.occurrenceDate as string); setLessonDialog(true); }}
          eventDrop={moveLesson}
          eventResize={resizeLesson}
        />
      </section>
      </>}
      {dataError && activeView === 'payments' && <div className="data-error floating-error" role="alert">{dataError}<button onClick={() => setDataError(null)}>×</button></div>}
    </main>
    {groupDialog && canManage && <GroupDialog onClose={() => setGroupDialog(false)} onSave={saveGroup} />}
    {teacherDialog && canManage && <TeacherAssignmentsDialog groups={groups} teachers={teachers} onAssign={assignTeacher} onClose={() => setTeacherDialog(false)} />}
    {parentDialog && canManage && <ParentAccessDialog students={students} groups={groups} access={parentAccess} onCreateStudent={async (name, groupIds) => { await createStudent(profile.schoolId, name, groupIds); await refreshParentViews(); }} onCreateLink={studentIds => createParentLink(profile.schoolId, studentIds)} onRegenerate={regenerateParentLink} onDisable={disableParentLink} onRebuild={refreshParentViews} onClose={() => setParentDialog(false)} />}
    {lessonDialog && <LessonDialog groups={groups} lesson={editingLesson} occurrenceDate={editingOccurrenceDate} initialDate={initialDate} teacherMode={teacherMode} onClose={() => setLessonDialog(false)} onSave={saveLesson} onDelete={canManage && editingLesson ? deleteLesson : undefined} />}
  </div>;
}
