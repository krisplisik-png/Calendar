import { useEffect, useMemo, useRef, useState } from 'react';
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
import { createGroup, createLesson, publishPublicLesson, removeGroup, removeLesson, removePublicLesson, savePublicLessonComment, setGroupTeacher, setLessonTeacher, subscribeToGroups, subscribeToLessons, subscribeToTeachers, updateGroup, updateLesson } from './data/firestore';
import { humanizeFirebaseError } from './lib/errors';
import type { Group, Lesson, SchoolUser } from './types';
import { expandLessonOccurrences } from './domain/recurrence';
import { PaymentsPage } from './components/PaymentsPage';
import { TeacherAssignmentsDialog } from './components/TeacherAssignmentsDialog';
import { ParentAccessDialog } from './components/ParentAccessDialog';
import { ParentPage } from './components/ParentPage';
import { GroupsExportDialog } from './components/GroupsExportDialog';
import { attachStudentToGroups, createParentLink, createStudent, disableParentLink, ensureParentLinkForStudent, rebuildParentView, rebuildParentViewsForSchool, regenerateParentLink, subscribeToParentAccess, subscribeToStudents, syncParentLinksFromSchedule, updateScheduledStudentName } from './data/firestore';
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
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
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
  const [parentSyncing, setParentSyncing] = useState(false);
  const [parentSyncError, setParentSyncError] = useState('');
  const parentSyncPromise = useRef<Promise<void> | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
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
    const tracksAttendance = ['group', 'individual'].includes(group?.kind ?? 'group');
    const occurrenceHasEnded = DateTime.fromISO(`${occurrenceDate}T${item.endTime}`, { zone: 'Asia/Yekaterinburg' }) <= now.setZone('Asia/Yekaterinburg');
    const attendanceState = tracksAttendance && occurrenceHasEnded
      ? (item.attendanceCompletedDates?.includes(occurrenceDate) ? 'attendance-complete' : 'attendance-missing')
      : '';
    return {
      id: recurring ? `${item.id}__${occurrenceDate}` : item.id,
      title: `${group?.name ?? 'Без группы'}${item.room ? ` · Каб. ${item.room}` : ''}${item.topic ? ` · ${item.topic}` : ''}`,
      start: `${occurrenceDate}T${item.startTime}`,
      end: `${occurrenceDate}T${item.endTime}`,
      backgroundColor: group?.color ?? '#a98be8', borderColor: group?.color ?? '#a98be8',
      classNames: attendanceState ? [attendanceState] : [],
      editable: !recurring,
      extendedProps: { lesson: item, occurrenceDate },
    };
  })), [lessons, groupMap, selectedGroups, search, now]);

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
  function syncParents() {
    if (parentSyncPromise.current) return parentSyncPromise.current;
    setParentSyncing(true);
    setParentSyncError('');
    const synchronization = syncParentLinksFromSchedule(profile.schoolId).then(() => undefined);
    const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Обновление заняло больше трёх минут. Проверьте интернет и нажмите «Обновить расписания» ещё раз.')), 180_000));
    const operation = Promise.race([synchronization, timeout]).catch(error => {
      setParentSyncError(humanizeFirebaseError(error));
      throw error;
    }).finally(() => {
      parentSyncPromise.current = null;
      setParentSyncing(false);
    });
    parentSyncPromise.current = operation;
    return operation;
  }
  async function saveGroup(input: GroupInput) { if (editingGroup) await updateGroup(editingGroup.id, input); else await createGroup(profile.schoolId, input); await syncParents(); }
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
    const { students: lessonStudents, parentComment, homeworkAssigned, ...lessonFields } = input;
    const statusDate = editingOccurrenceDate ?? input.date;
    const studentRoster = lessonStudents.map(student => ({ id: student.id, fullName: student.fullName.trim() })).filter(student => student.fullName);
    const dateStatuses = Object.fromEntries(lessonStudents.filter(student => student.fullName.trim()).map(student => [student.id, { attended: student.attended, homeworkDone: homeworkAssigned ? student.homeworkDone : false, homeworkAssigned }]));
    const studentStatusByDate = { ...(editingLesson?.studentStatusByDate ?? {}), [statusDate]: dateStatuses };
    const attendanceCompletedDates = editingLesson
      ? Array.from(new Set([...(editingLesson.attendanceCompletedDates ?? []), statusDate])).sort()
      : [];
    const commentsForDate = Object.fromEntries(lessonStudents.filter(student => student.fullName.trim()).map(student => [student.id, student.parentComment.trim()]));
    commentsForDate.__general = parentComment.trim();
    const parentCommentByDate = { ...(editingLesson?.parentCommentByDate ?? {}), [statusDate]: commentsForDate };
    const previousComments = editingLesson?.parentCommentByDate?.[statusDate] ?? {};
    const changedComments = Object.entries(commentsForDate).filter(([commentKey, comment]) => commentKey !== '__general' || comment || previousComments[commentKey]);
    const publishComments = async (lessonId: string) => {
      if (!changedComments.length) return;
      const writes = Promise.all(changedComments.map(([commentKey, comment]) => savePublicLessonComment(profile.schoolId, lessonId, statusDate, commentKey, comment, commentKey === '__general' ? undefined : dateStatuses[commentKey]?.homeworkDone, commentKey === '__general' ? undefined : dateStatuses[commentKey]?.homeworkAssigned)));
      await Promise.race([
        writes,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Firebase слишком долго сохраняет комментарий. Проверьте интернет и попробуйте ещё раз.')), 15000)),
      ]);
    };
    const propagateCorrectedStudentNames = async () => {
      if (!canManage || !editingLesson) return;
      const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
      const corrections = studentRoster.flatMap(current => {
        const previous = editingLesson.studentRoster?.find(item => item.id === current.id);
        return previous && normalize(previous.fullName) !== normalize(current.fullName)
          ? [{ rosterId: current.id, previousName: previous.fullName, fullName: current.fullName }]
          : [];
      });
      for (const correction of corrections) {
        await updateScheduledStudentName(profile.schoolId, input.groupId, correction.rosterId, correction.previousName, correction.fullName);
        await Promise.all(lessons.filter(item => item.groupId === input.groupId && item.id !== editingLesson.id).map(item => {
          const roster = item.studentRoster ?? [];
          let changed = false;
          const updatedRoster = roster.map(rosterStudent => {
            if (rosterStudent.id !== correction.rosterId && normalize(rosterStudent.fullName) !== normalize(correction.previousName)) return rosterStudent;
            changed = true;
            return { ...rosterStudent, fullName: correction.fullName };
          });
          return changed ? updateLesson(item.id, { studentRoster: updatedRoster }) : Promise.resolve();
        }));
      }
    };
    if (teacherMode && editingLesson) {
      await updateLesson(editingLesson.id, { homework: input.homework, notes: input.notes, studentRoster, studentStatusByDate, attendanceCompletedDates, parentCommentByDate });
      await publishComments(editingLesson.id);
      return;
    }
    const assignedTeacherId = groups.find(group => group.id === input.groupId)?.teacherId;
    const selectedGroup = groups.find(group => group.id === input.groupId);
    const payload = {
      ...lessonFields,
      ...(assignedTeacherId ? { teacherId: assignedTeacherId } : {}),
      studentRoster,
      studentStatusByDate,
      attendanceCompletedDates,
      parentCommentByDate,
    };
    if (editingLesson) {
      await updateLesson(editingLesson.id, payload);
      await propagateCorrectedStudentNames();
      await publishPublicLesson(editingLesson.id, profile.schoolId, { ...editingLesson, ...payload }, selectedGroup);
      await publishComments(editingLesson.id);
    } else {
      const created = await createLesson(profile.schoolId, payload);
      await publishPublicLesson(created.id, profile.schoolId, payload, selectedGroup);
      await publishComments(created.id);
    }
    void syncParents().catch(error => setDataError(humanizeFirebaseError(error)));
  }
  async function addStudentManually(fullName: string, groupIds: string[]) {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    let student = students.find(item => item.active !== false && normalize(item.fullName) === normalize(cleanName));
    if (student) {
      await attachStudentToGroups(student, groupIds);
    } else {
      const reference = await createStudent(profile.schoolId, cleanName, groupIds);
      student = { id: reference.id, schoolId: profile.schoolId, fullName: cleanName, groupIds, active: true } as Student;
    }
    await Promise.all(lessons.filter(lesson => groupIds.includes(lesson.groupId)).map(lesson => {
      const roster = lesson.studentRoster ?? [];
      const exists = roster.some(item => normalize(item.fullName) === normalize(cleanName));
      return exists ? Promise.resolve() : updateLesson(lesson.id, { studentRoster: [...roster, { id: student!.id, fullName: cleanName }] });
    }));
    const existingAccess = parentAccess.find(item => item.active && item.studentIds.includes(student!.id));
    if (!existingAccess) await createParentLink(profile.schoolId, [student.id]);
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
  async function assignSubstitute(group: Group, substituteTeacherId: string, dateFrom: string, dateTo: string) {
    if (dateTo < dateFrom) throw new Error('Дата окончания замены не может быть раньше даты начала.');
    try {
      await updateGroup(group.id, { authorizedTeacherIds: Array.from(new Set([...(group.authorizedTeacherIds ?? []), substituteTeacherId])) });
      let assignedCount = 0;
      for (const source of lessons.filter(item => item.groupId === group.id)) {
        const dates = expandLessonOccurrences(source).map(item => item.occurrenceDate).filter(date => date >= dateFrom && date <= dateTo);
        if (!dates.length) continue;
        if (source.recurrenceWeekdays?.length && source.recurrenceUntil) {
          for (const date of dates) {
            const statusForDate = source.studentStatusByDate?.[date];
            const cloneInput = Object.fromEntries(Object.entries({
              groupId: source.groupId, teacherId: substituteTeacherId, substituteForTeacherId: source.teacherId ?? '', substitutionDate: date,
              date, startTime: source.startTime, endTime: source.endTime, course: source.course ?? '', unit: source.unit ?? '', lesson: source.lesson ?? '', topic: source.topic ?? '',
              homework: source.homework ?? '', notes: source.notes ?? '', room: source.room ?? '', minAge: source.minAge, maxAge: source.maxAge,
              billingType: source.billingType ?? 'subscription', recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [], studentRoster: source.studentRoster ?? [],
              studentStatusByDate: statusForDate ? { [date]: statusForDate } : {},
              parentCommentByDate: source.parentCommentByDate?.[date] ? { [date]: source.parentCommentByDate[date] } : {},
            }).filter(([, value]) => value !== undefined)) as unknown as Omit<Lesson, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>;
            const created = await createLesson(profile.schoolId, cloneInput);
            await publishPublicLesson(created.id, profile.schoolId, cloneInput, group);
            await Promise.all(Object.entries(source.parentCommentByDate?.[date] ?? {}).map(([commentKey, comment]) => savePublicLessonComment(profile.schoolId, created.id, date, commentKey, comment)));
            assignedCount += 1;
          }
          const excludedDates = Array.from(new Set([...(source.excludedDates ?? []), ...dates])).sort();
          await updateLesson(source.id, { excludedDates });
          await publishPublicLesson(source.id, profile.schoolId, { ...source, excludedDates }, group);
        } else {
          await setLessonTeacher(source.id, substituteTeacherId);
          assignedCount += 1;
        }
      }
      await refreshParentViews();
      return assignedCount;
    } catch (error) {
      setDataError(humanizeFirebaseError(error));
      throw error;
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
    <Sidebar profile={userProfile} groups={groups} selected={selectedGroups} onToggle={toggleGroup} onAddGroup={() => { setEditingGroup(null); setGroupDialog(true); }} onEditGroup={group => { setEditingGroup(group); setGroupDialog(true); }} onDeleteGroup={deleteGroup} activeView={activeView} onNavigate={setActiveView} canManage={canManage} onManageTeachers={() => setTeacherDialog(true)} onManageParents={() => setParentDialog(true)} onExportGroups={() => setExportDialog(true)} onLogout={logout} />
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
        <div className="attendance-legend"><span className="complete">Посещаемость заполнена</span><span className="missing">Нужно заполнить</span></div>
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
    {groupDialog && canManage && <GroupDialog group={editingGroup} onClose={() => { setGroupDialog(false); setEditingGroup(null); }} onSave={saveGroup} />}
    {teacherDialog && canManage && <TeacherAssignmentsDialog groups={groups} teachers={teachers} onAssign={assignTeacher} onSubstitute={assignSubstitute} onClose={() => setTeacherDialog(false)} />}
    {parentDialog && canManage && <ParentAccessDialog students={students} groups={groups} lessons={lessons} access={parentAccess} syncing={parentSyncing} syncError={parentSyncError} onCreateStudent={addStudentManually} onCreateLink={studentIds => createParentLink(profile.schoolId, studentIds)} onCreateMissingLink={(fullName, groupIds) => ensureParentLinkForStudent(profile.schoolId, fullName, groupIds)} onPrepare={rebuildParentView} onRegenerate={regenerateParentLink} onDisable={disableParentLink} onRebuild={syncParents} onClose={() => setParentDialog(false)} />}
    {exportDialog && canManage && <GroupsExportDialog groups={groups} lessons={lessons} students={students} access={parentAccess} teachers={teachers} syncing={parentSyncing} onClose={() => setExportDialog(false)} />}
    {lessonDialog && <LessonDialog groups={groups} lesson={editingLesson} occurrenceDate={editingOccurrenceDate} initialDate={initialDate} teacherMode={teacherMode} onClose={() => setLessonDialog(false)} onSave={saveLesson} onDelete={canManage && editingLesson ? deleteLesson : undefined} />}
  </div>;
}
