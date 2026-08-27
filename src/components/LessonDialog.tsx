import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Group, GroupKind, Lesson } from '../types';

export interface StudentStatusInput {
  id: string;
  fullName: string;
  attended: boolean;
  homeworkDone: boolean;
}

export interface LessonInput {
  groupId: string; date: string; startTime: string; endTime: string;
  minAge?: number; maxAge?: number;
  course: string; unit: string; lesson: string; topic: string; homework: string; notes: string;
  recurrenceWeekdays: number[]; recurrenceUntil: string; excludedDates: string[];
  students: StudentStatusInput[];
  billingType: 'subscription' | 'single';
}

const empty = (): LessonInput => ({ groupId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '11:00', course: '', unit: '', lesson: '', topic: '', homework: '', notes: '', recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [], students: [], billingType: 'single' });

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
    setValue(lesson ? {
      groupId: lesson.groupId, date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime, minAge: lesson.minAge, maxAge: lesson.maxAge,
      course: lesson.course ?? '', unit: lesson.unit ?? '', lesson: lesson.lesson ?? '', topic: lesson.topic ?? '', homework: lesson.homework ?? '', notes: lesson.notes ?? '',
      recurrenceWeekdays: lesson.recurrenceWeekdays ?? [], recurrenceUntil: lesson.recurrenceUntil ?? '', excludedDates: lesson.excludedDates ?? [],
      students: (lesson.studentRoster ?? []).map(student => ({ id: student.id, fullName: student.fullName, attended: statuses[student.id]?.attended ?? false, homeworkDone: statuses[student.id]?.homeworkDone ?? false })),
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
  function addStudent() {
    setValue(current => ({ ...current, students: [...current.students, { id: crypto.randomUUID(), fullName: '', attended: false, homeworkDone: false }] }));
  }
  function updateStudent(id: string, patch: Partial<StudentStatusInput>) {
    setValue(current => ({ ...current, students: current.students.map(student => student.id === id ? { ...student, ...patch } : student) }));
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
      <label>{selectedKind === 'individual' ? 'Ученик' : selectedKind === 'pair' ? 'Пара' : 'Группа'}<select value={value.groupId} onChange={e => setValue({ ...value, groupId: e.target.value })} required disabled={teacherMode}><option value="">{availableParticipants.length ? 'Выберите из списка' : `Сначала добавьте: ${selectedKind === 'individual' ? 'индивидуального ученика' : selectedKind === 'pair' ? 'пару' : 'группу'}`}</option>{availableParticipants.map(participant => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></label>
      {selectedKind === 'group' && <div className="form-grid"><label>Возраст от<input type="number" min="3" max="18" value={value.minAge ?? ''} onChange={e => setValue({ ...value, minAge: e.target.value ? Number(e.target.value) : undefined })} required disabled={teacherMode} placeholder="Например, 7" /></label><label>Возраст до<input type="number" min="3" max="18" value={value.maxAge ?? ''} onChange={e => setValue({ ...value, maxAge: e.target.value ? Number(e.target.value) : undefined })} required disabled={teacherMode} placeholder="Например, 9" /></label></div>}
      <div className="form-grid three"><label>Дата<input type="date" value={value.date} onChange={e => setValue({ ...value, date: e.target.value })} required disabled={teacherMode} /></label><label>Начало<input type="time" value={value.startTime} onChange={e => setValue({ ...value, startTime: e.target.value })} required disabled={teacherMode} /></label><label>Конец<input type="time" value={value.endTime} onChange={e => setValue({ ...value, endTime: e.target.value })} required disabled={teacherMode} /></label></div>
      <fieldset className="billing-type"><legend>Оплата занятия</legend><label className={value.billingType === 'subscription' ? 'selected' : ''}><input type="radio" name="billing-type" checked={value.billingType === 'subscription'} onChange={() => setValue({ ...value, billingType: 'subscription' })} disabled={teacherMode} />По абонементу</label><label className={value.billingType === 'single' ? 'selected' : ''}><input type="radio" name="billing-type" checked={value.billingType === 'single'} onChange={() => setValue({ ...value, billingType: 'single' })} disabled={teacherMode} />Разовый урок</label></fieldset>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} disabled={teacherMode} /></label><label>Тема<input value={value.topic} onChange={e => setValue({ ...value, topic: e.target.value })} disabled={teacherMode} /></label></div>
      <div className="form-grid"><label>Юнит<input value={value.unit} onChange={e => setValue({ ...value, unit: e.target.value })} disabled={teacherMode} /></label><label>Урок<input value={value.lesson} onChange={e => setValue({ ...value, lesson: e.target.value })} disabled={teacherMode} /></label></div>
      {selectedKind === 'group' && <section className="student-journal">
        <div className="student-journal-header"><div><span className="field-caption">Ученики группы</span><small>Посещение и домашняя работа на {occurrenceDate ?? value.date}</small></div><button type="button" className="ghost-button" onClick={addStudent}><Plus size={15} />Добавить ФИ</button></div>
        {value.students.length ? <div className="student-list">
          <div className="student-list-head"><span>Фамилия и имя</span><span>Посещение</span><span /></div>
          {value.students.map(student => <div className="student-row" key={student.id}>
            <input aria-label="Фамилия и имя ученика" placeholder="Фамилия и имя" value={student.fullName} onChange={e => updateStudent(student.id, { fullName: e.target.value })} required />
            <div className="status-choice" aria-label="Посещение">
              <button type="button" className={student.attended ? 'status-option positive selected' : 'status-option'} onClick={() => updateStudent(student.id, { attended: true })}>Был</button>
              <button type="button" className={!student.attended ? 'status-option negative selected' : 'status-option'} onClick={() => updateStudent(student.id, { attended: false })}>Не был</button>
            </div>
            <button type="button" className="remove-student" onClick={() => removeStudent(student.id)} aria-label="Удалить ученика из списка"><Trash2 size={15} /></button>
          </div>)}
        </div> : <p className="journal-empty">Добавьте ФИ учеников, чтобы отмечать посещение и домашнюю работу.</p>}
      </section>}
      <section className="recurrence-section">
        <label className="repeat-toggle"><input type="checkbox" checked={repeats} onChange={e => { setRepeats(e.target.checked); if (e.target.checked) setValue(current => ({ ...current, billingType: 'subscription' })); }} disabled={teacherMode} /><span>Повторять занятие</span></label>
        {repeats && <div className="recurrence-fields">
          <span className="field-caption">Дни недели</span>
          <div className="weekday-picker">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label, index) => <button type="button" className={value.recurrenceWeekdays.includes(index + 1) ? 'selected' : ''} onClick={() => toggleWeekday(index + 1)} disabled={teacherMode} key={label}>{label}</button>)}</div>
          {!value.recurrenceWeekdays.length && <small className="validation-hint">Выберите хотя бы один день</small>}
          <label>Повторять до<input type="date" min={value.date} value={value.recurrenceUntil} onChange={e => setValue({ ...value, recurrenceUntil: e.target.value })} required={repeats} disabled={teacherMode} /></label>
        </div>}
      </section>
      <label>Домашнее задание<textarea value={value.homework} onChange={e => setValue({ ...value, homework: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      {confirmDelete && <div className="delete-confirm lesson-delete-confirm" role="alert"><span>{lesson?.recurrenceWeekdays?.length ? 'Что нужно удалить?' : 'Точно удалить это занятие?'}</span><button type="button" className="ghost-button" onClick={() => setConfirmDelete(false)}>Отмена</button>{lesson?.recurrenceWeekdays?.length ? <><button type="button" className="danger-button" onClick={() => remove('occurrence')}>Только это занятие</button><button type="button" className="danger-button" onClick={() => remove('series')}>Всю серию</button></> : <button type="button" className="danger-button" onClick={() => remove('series')}>Да, удалить</button>}</div>}
      {saveError && <div className="form-error" role="alert">{saveError}</div>}
      <footer>{onDelete && !confirmDelete && <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Удалить</button>}<span className="footer-spacer" /><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </div>;
}
