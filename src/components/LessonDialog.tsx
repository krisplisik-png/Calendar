import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Group, GroupKind, Lesson } from '../types';

export interface StudentStatusInput {
  id: string;
  fullName: string;
  attended: boolean;
  homeworkDone: boolean;
  homeworkAssigned: boolean;
  parentComment: string;
}

export interface LessonInput {
  groupId: string; date: string; startTime: string; endTime: string;
  minAge?: number; maxAge?: number;
  course: string; unit: string; lesson: string; topic: string; homework: string; notes: string;
  room: '' | '1' | '2';
  parentComment: string;
  homeworkAssigned: boolean;
  recurrenceWeekdays: number[]; recurrenceUntil: string; excludedDates: string[];
  students: StudentStatusInput[];
  billingType: 'subscription' | 'single';
}

const empty = (): LessonInput => ({ groupId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '11:00', course: '', unit: '', lesson: '', topic: '', homework: '', notes: '', room: '', parentComment: '', homeworkAssigned: true, recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [], students: [], billingType: 'single' });

export function LessonDialog({ groups, lesson, occurrenceDate, initialDate, teacherMode = false, onClose, onSave, onDelete }: {
  groups: Group[]; lesson: Lesson | null; occurrenceDate?: string | null; initialDate?: string; onClose: () => void;
  teacherMode?: boolean;
  onSave: (value: LessonInput) => Promise<void>;
  onDelete?: (scope: 'occurrence' | 'series') => Promise<void>;
}) {
  const [value, setValue] = useState<LessonInput>(empty());
  const [selectedKind, setSelectedKind] = useState<GroupKind>('individual');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repeats, setRepeats] = useState(false);
  useEffect(() => {
    const existingGroup = lesson ? groups.find(group => group.id === lesson.groupId) : undefined;
    const initialKind = existingGroup?.kind ?? (lesson ? 'group' : 'individual');
    setSelectedKind(initialKind);
    const statusDate = occurrenceDate ?? lesson?.date ?? initialDate ?? empty().date;
    const statuses = lesson?.studentStatusByDate?.[statusDate] ?? {};
    const hasSavedStatuses = Object.keys(statuses).length > 0;
    const homeworkAssigned = Object.values(statuses).some(status => status.homeworkAssigned === true) || (!hasSavedStatuses && Boolean(lesson?.homework?.trim()));
    const comments = lesson?.parentCommentByDate?.[statusDate] ?? {};
    const rosterStudents = (lesson?.studentRoster ?? []).map(student => ({
      id: student.id,
      fullName: student.fullName,
      attended: statuses[student.id]?.attended ?? false,
      homeworkDone: statuses[student.id]?.homeworkDone ?? false,
      homeworkAssigned: statuses[student.id]?.homeworkAssigned ?? statuses[student.id]?.homeworkDone === true,
      parentComment: comments[student.id] ?? '',
    }));
    const formStudents = initialKind === 'individual' && existingGroup
      ? (() => {
          const stableId = `individual_${existingGroup.id}`;
          const previousStudent = rosterStudents[0];
          const savedStatus = statuses[stableId]
            ?? (previousStudent ? statuses[previousStudent.id] : undefined)
            ?? Object.values(statuses)[0];
          return [{
            id: stableId,
            fullName: existingGroup.name,
            attended: savedStatus?.attended ?? false,
            homeworkDone: savedStatus?.homeworkDone ?? false,
            homeworkAssigned: savedStatus?.homeworkAssigned ?? savedStatus?.homeworkDone === true,
            parentComment: comments[stableId] ?? (previousStudent ? comments[previousStudent.id] : '') ?? '',
          }];
        })()
      : rosterStudents;
    setValue(lesson ? {
      groupId: lesson.groupId, date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime, minAge: lesson.minAge, maxAge: lesson.maxAge,
      course: lesson.course ?? '', unit: lesson.unit ?? '', lesson: lesson.lesson ?? '', topic: lesson.topic ?? '', homework: lesson.homework ?? '', notes: lesson.notes ?? '', room: lesson.room ?? '', parentComment: lesson.parentCommentByDate?.[statusDate]?.__general ?? '', homeworkAssigned,
      recurrenceWeekdays: lesson.recurrenceWeekdays ?? [], recurrenceUntil: lesson.recurrenceUntil ?? '', excludedDates: lesson.excludedDates ?? [],
      students: formStudents,
      billingType: lesson.billingType ?? (lesson.recurrenceWeekdays?.length ? 'subscription' : 'single'),
    } : { ...empty(), groupId: '', date: initialDate ?? empty().date });
    setRepeats(Boolean(lesson?.recurrenceWeekdays?.length && lesson.recurrenceUntil));
  }, [lesson, groups, initialDate, occurrenceDate]);
  const availableParticipants = groups.filter(group => (group.kind ?? 'group') === selectedKind);
  const kindLabels: Array<{ kind: GroupKind; label: string }> = [
    { kind: 'individual', label: 'Индивидуал' },
    { kind: 'pair', label: 'Пара' },
    { kind: 'group', label: 'Группа' },
  ];
  function selectKind(kind: GroupKind) {
    setSelectedKind(kind);
    setValue(current => ({ ...current, groupId: '', students: kind === 'group' ? current.students : [] }));
  }
  function selectParticipant(groupId: string) {
    const participant = groups.find(group => group.id === groupId);
    setValue(current => ({
      ...current,
      groupId,
      students: selectedKind === 'individual' && participant
        ? [{ id: `individual_${participant.id}`, fullName: participant.name, attended: false, homeworkDone: false, homeworkAssigned: false, parentComment: '' }]
        : selectedKind === 'group' ? current.students : [],
    }));
  }
  function addStudent() {
    setValue(current => ({ ...current, students: [...current.students, { id: crypto.randomUUID(), fullName: '', attended: false, homeworkDone: false, homeworkAssigned: false, parentComment: '' }] }));
  }
  function updateStudent(id: string, patch: Partial<StudentStatusInput>) {
    setValue(current => ({ ...current, students: current.students.map(student => student.id === id ? { ...student, ...patch } : student) }));
  }
  function setHomeworkResult(id: string, homeworkDone: boolean) {
    setValue(current => ({ ...current, homeworkAssigned: true, students: current.students.map(student => student.id === id ? { ...student, homeworkAssigned: true, homeworkDone } : student) }));
  }
  function setHomeworkNotAssigned(notAssigned: boolean) {
    setValue(current => ({ ...current, homeworkAssigned: !notAssigned, homework: notAssigned ? '' : current.homework, students: current.students.map(student => ({ ...student, homeworkAssigned: !notAssigned, ...(notAssigned ? { homeworkDone: false } : {}) })) }));
  }
  function removeStudent(id: string) {
    setValue(current => ({ ...current, students: current.students.filter(student => student.id !== id) }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaveError('');
    if (repeats && (!value.recurrenceWeekdays.length || !value.recurrenceUntil)) {
      setSaveError('Выберите дни недели и дату окончания повторений.');
      return;
    }
    if (selectedKind === 'group' && (!value.minAge || !value.maxAge || value.minAge > value.maxAge)) {
      setSaveError('Проверьте возраст: заполните оба поля, а возраст «от» должен быть не больше возраста «до».');
      return;
    }
    setBusy(true);
    try {
      await onSave(repeats ? value : { ...value, recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [] });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message.includes('permission-denied') || message.includes('Missing or insufficient permissions')
        ? 'Firebase отклонил сохранение: не хватает прав доступа. Обновите страницу и войдите снова.'
        : `Не удалось сохранить занятие: ${message}`);
    } finally { setBusy(false); }
  }
  async function remove(scope: 'occurrence' | 'series') { if (!onDelete) return; setBusy(true); try { await onDelete(scope); onClose(); } finally { setBusy(false); } }
  function toggleWeekday(day: number) {
    setValue(current => ({ ...current, recurrenceWeekdays: current.recurrenceWeekdays.includes(day) ? current.recurrenceWeekdays.filter(item => item !== day) : [...current.recurrenceWeekdays, day].sort() }));
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog lesson-dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">РАСПИСАНИЕ</p><h2>{lesson ? 'Редактировать занятие' : 'Новое занятие'}</h2></div><button type="button" onClick={onClose}><X /></button></header>
      {teacherMode && <div className="teacher-mode-note">Режим учителя: можно отметить посещение и домашнюю работу, а также написать домашнее задание.</div>}
      <fieldset className="lesson-kind-options">
        <legend>Формат занятия</legend>
        {kindLabels.map(option => <label className={selectedKind === option.kind ? 'kind-option selected' : 'kind-option'} key={option.kind}>
          <input type="radio" name="lesson-kind" value={option.kind} checked={selectedKind === option.kind} onChange={() => selectKind(option.kind)} disabled={teacherMode} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      <label>{selectedKind === 'individual' ? 'Ученик' : selectedKind === 'pair' ? 'Пара' : 'Группа'}<select value={value.groupId} onChange={e => selectParticipant(e.target.value)} required disabled={teacherMode}><option value="">{availableParticipants.length ? 'Выберите из списка' : `Сначала добавьте: ${selectedKind === 'individual' ? 'индивидуального ученика' : selectedKind === 'pair' ? 'пару' : 'группу'}`}</option>{availableParticipants.map(participant => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></label>
      {selectedKind === 'group' && <div className="form-grid"><label>Возраст от<input type="number" min="3" max="18" value={value.minAge ?? ''} onChange={e => setValue({ ...value, minAge: e.target.value ? Number(e.target.value) : undefined })} required disabled={teacherMode} placeholder="Например, 7" /></label><label>Возраст до<input type="number" min="3" max="18" value={value.maxAge ?? ''} onChange={e => setValue({ ...value, maxAge: e.target.value ? Number(e.target.value) : undefined })} required disabled={teacherMode} placeholder="Например, 9" /></label></div>}
      <div className="form-grid three"><label>Дата<input type="date" value={value.date} onChange={e => setValue({ ...value, date: e.target.value })} required disabled={teacherMode} /></label><label>Начало<input type="time" value={value.startTime} onChange={e => setValue({ ...value, startTime: e.target.value })} required disabled={teacherMode} /></label><label>Конец<input type="time" value={value.endTime} onChange={e => setValue({ ...value, endTime: e.target.value })} required disabled={teacherMode} /></label></div>
      <label>Кабинет<select value={value.room} onChange={e => setValue({ ...value, room: e.target.value as LessonInput['room'] })} disabled={teacherMode}><option value="">Не указан</option><option value="1">Кабинет 1</option><option value="2">Кабинет 2</option></select></label>
      <fieldset className="billing-type"><legend>Как считать оплату</legend><label className={value.billingType === 'subscription' ? 'selected' : ''}><input type="radio" name="billing-type" checked={value.billingType === 'subscription'} onChange={() => setValue({ ...value, billingType: 'subscription' })} disabled={teacherMode} />Цена по абонементу</label><label className={value.billingType === 'single' ? 'selected' : ''}><input type="radio" name="billing-type" checked={value.billingType === 'single'} onChange={() => setValue({ ...value, billingType: 'single' })} disabled={teacherMode} />Цена разового урока</label><small className="billing-help">Каждое занятие автоматически попадёт в оплату выбранного месяца. Для разового урока конкретному ученику выберите формат «Индивидуал», ученика и «Цена разового урока».</small></fieldset>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} disabled={teacherMode} /></label><label>Тема<input value={value.topic} onChange={e => setValue({ ...value, topic: e.target.value })} disabled={teacherMode} /></label></div>
      <div className="form-grid"><label>Юнит<input value={value.unit} onChange={e => setValue({ ...value, unit: e.target.value })} disabled={teacherMode} /></label><label>Урок<input value={value.lesson} onChange={e => setValue({ ...value, lesson: e.target.value })} disabled={teacherMode} /></label></div>
      {selectedKind === 'group' && <section className="student-journal">
        <div className="student-journal-header"><div><span className="field-caption">Ученики группы</span><small>Посещение и домашняя работа на {occurrenceDate ?? value.date}</small></div><button type="button" className="ghost-button" onClick={addStudent}><Plus size={15} />Добавить ФИ</button></div>
        {value.students.length ? <div className="student-list">
          <div className="student-list-head"><span>Фамилия и имя</span><span>Посещение</span><span>Д/з</span><span>Комментарий родителю</span><span /></div>
          {value.students.map(student => <div className="student-row" key={student.id}>
            <input aria-label="Фамилия и имя ученика" placeholder="Фамилия и имя" value={student.fullName} onChange={e => updateStudent(student.id, { fullName: e.target.value })} required />
            <div className="status-choice" aria-label="Посещение">
              <button type="button" className={student.attended ? 'status-option positive selected' : 'status-option'} onClick={() => updateStudent(student.id, { attended: true })}>Был</button>
              <button type="button" className={!student.attended ? 'status-option negative selected' : 'status-option'} onClick={() => updateStudent(student.id, { attended: false })}>Не был</button>
            </div>
            <div className="status-choice" aria-label={`Домашняя работа ${student.fullName}`}>
              <button type="button" disabled={!value.homeworkAssigned} className={value.homeworkAssigned && student.homeworkDone ? 'status-option positive selected' : 'status-option'} onClick={() => setHomeworkResult(student.id, true)}>Есть</button>
              <button type="button" disabled={!value.homeworkAssigned} className={value.homeworkAssigned && !student.homeworkDone ? 'status-option negative selected' : 'status-option'} onClick={() => setHomeworkResult(student.id, false)}>Нет</button>
            </div>
            <input className="parent-comment-input" aria-label={`Комментарий родителю ${student.fullName}`} placeholder="Похвала или замечание" value={student.parentComment} onChange={e => updateStudent(student.id, { parentComment: e.target.value })} />
            <button type="button" className="remove-student" onClick={() => removeStudent(student.id)} aria-label="Удалить ученика из списка"><Trash2 size={15} /></button>
          </div>)}
        </div> : <p className="journal-empty">Добавьте ФИ учеников, чтобы отмечать посещение и домашнюю работу.</p>}
      </section>}
      {selectedKind === 'individual' && value.students[0] && <section className="student-journal individual-attendance"><div className="student-journal-header"><div><span className="field-caption">Посещение и Д/з</span><small>Отметка на {occurrenceDate ?? value.date}</small></div></div><div className="individual-attendance-row"><strong>{value.students[0].fullName}</strong><div className="status-choice" aria-label="Посещение"><button type="button" className={value.students[0].attended ? 'status-option positive selected' : 'status-option'} onClick={() => updateStudent(value.students[0].id, { attended: true })}>Был</button><button type="button" className={!value.students[0].attended ? 'status-option negative selected' : 'status-option'} onClick={() => updateStudent(value.students[0].id, { attended: false })}>Не был</button></div><div className="status-choice" aria-label="Домашняя работа"><button type="button" disabled={!value.homeworkAssigned} className={value.homeworkAssigned && value.students[0].homeworkDone ? 'status-option positive selected' : 'status-option'} onClick={() => setHomeworkResult(value.students[0].id, true)}>Есть</button><button type="button" disabled={!value.homeworkAssigned} className={value.homeworkAssigned && !value.students[0].homeworkDone ? 'status-option negative selected' : 'status-option'} onClick={() => setHomeworkResult(value.students[0].id, false)}>Нет</button></div></div></section>}
      <section className="recurrence-section">
        <label className="repeat-toggle"><input type="checkbox" checked={repeats} onChange={e => { setRepeats(e.target.checked); if (e.target.checked) setValue(current => ({ ...current, billingType: 'subscription' })); }} disabled={teacherMode} /><span>Повторять занятие</span></label>
        {repeats && <div className="recurrence-fields">
          <span className="field-caption">Дни недели</span>
          <div className="weekday-picker">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label, index) => <button type="button" className={value.recurrenceWeekdays.includes(index + 1) ? 'selected' : ''} onClick={() => toggleWeekday(index + 1)} disabled={teacherMode} key={label}>{label}</button>)}</div>
          {!value.recurrenceWeekdays.length && <small className="validation-hint">Выберите хотя бы один день</small>}
          <label>Повторять до<input type="date" min={value.date} value={value.recurrenceUntil} onChange={e => setValue({ ...value, recurrenceUntil: e.target.value })} required={repeats} disabled={teacherMode} /></label>
          <small className="calculation-note">Календарь сам посчитает все выбранные дни каждого месяца. Например, понедельник и четверг будут посчитаны по их фактическому количеству в месяце.</small>
        </div>}
      </section>
      <section className="homework-editor"><label>Домашнее задание<textarea value={value.homework} disabled={!value.homeworkAssigned} onChange={e => setValue({ ...value, homework: e.target.value, homeworkAssigned: Boolean(e.target.value.trim()) || value.homeworkAssigned })} placeholder={value.homeworkAssigned ? 'Напишите домашнюю работу' : 'Домашняя работа не задавалась'} /></label><label className="homework-not-assigned"><input type="checkbox" checked={!value.homeworkAssigned} onChange={e => setHomeworkNotAssigned(e.target.checked)} /><span><strong>Не задавала</strong><small>Это занятие не попадет в подсчет домашних работ</small></span></label></section>
      {selectedKind !== 'group' && <label>Комментарий для родителей<textarea value={value.parentComment} onChange={e => setValue({ ...value, parentComment: e.target.value })} placeholder="Например: Сегодня отлично отвечал и очень старался" /><small className="field-help">Родитель увидит этот комментарий при открытии данного урока. Внутренние заметки ниже родителю не показываются.</small></label>}
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      {confirmDelete && <div className="delete-confirm lesson-delete-confirm" role="alert"><span>{lesson?.recurrenceWeekdays?.length ? 'Что нужно удалить?' : 'Точно удалить это занятие?'}</span><button type="button" className="ghost-button" onClick={() => setConfirmDelete(false)}>Отмена</button>{lesson?.recurrenceWeekdays?.length ? <><button type="button" className="danger-button" onClick={() => remove('occurrence')}>Только это занятие</button><button type="button" className="danger-button" onClick={() => remove('series')}>Всю серию</button></> : <button type="button" className="danger-button" onClick={() => remove('series')}>Да, удалить</button>}</div>}
      {saveError && <div className="form-error" role="alert">{saveError}</div>}
      <footer>{onDelete && !confirmDelete && <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Удалить</button>}<span className="footer-spacer" /><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </div>;
}
