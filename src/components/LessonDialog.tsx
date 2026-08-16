import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Group, GroupKind, Lesson } from '../types';

export interface LessonInput {
  groupId: string; date: string; startTime: string; endTime: string;
  course: string; unit: string; lesson: string; topic: string; homework: string; notes: string;
  recurrenceWeekdays: number[]; recurrenceUntil: string; excludedDates: string[];
}

const empty = (): LessonInput => ({ groupId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '11:00', course: '', unit: '', lesson: '', topic: '', homework: '', notes: '', recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [] });

export function LessonDialog({ groups, lesson, initialDate, onClose, onSave, onDelete }: {
  groups: Group[]; lesson: Lesson | null; initialDate?: string; onClose: () => void;
  onSave: (value: LessonInput) => Promise<void>;
  onDelete?: (scope: 'occurrence' | 'series') => Promise<void>;
}) {
  const [value, setValue] = useState<LessonInput>(empty());
  const [selectedKind, setSelectedKind] = useState<GroupKind>('individual');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repeats, setRepeats] = useState(false);
  useEffect(() => {
    const existingGroup = lesson ? groups.find(group => group.id === lesson.groupId) : undefined;
    const initialKind = existingGroup?.kind ?? (lesson ? 'group' : 'individual');
    setSelectedKind(initialKind);
    setValue(lesson ? {
      groupId: lesson.groupId, date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime,
      course: lesson.course ?? '', unit: lesson.unit ?? '', lesson: lesson.lesson ?? '', topic: lesson.topic ?? '', homework: lesson.homework ?? '', notes: lesson.notes ?? '',
      recurrenceWeekdays: lesson.recurrenceWeekdays ?? [], recurrenceUntil: lesson.recurrenceUntil ?? '', excludedDates: lesson.excludedDates ?? [],
    } : { ...empty(), groupId: '', date: initialDate ?? empty().date });
    setRepeats(Boolean(lesson?.recurrenceWeekdays?.length && lesson.recurrenceUntil));
  }, [lesson, groups, initialDate]);
  const availableParticipants = groups.filter(group => (group.kind ?? 'group') === selectedKind);
  const kindLabels: Array<{ kind: GroupKind; label: string }> = [
    { kind: 'individual', label: 'Индивидуал' },
    { kind: 'pair', label: 'Пара' },
    { kind: 'group', label: 'Группа' },
  ];
  function selectKind(kind: GroupKind) {
    setSelectedKind(kind);
    setValue(current => ({ ...current, groupId: '' }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (repeats && (!value.recurrenceWeekdays.length || !value.recurrenceUntil)) return;
    setBusy(true);
    try { await onSave(repeats ? value : { ...value, recurrenceWeekdays: [], recurrenceUntil: '', excludedDates: [] }); onClose(); } finally { setBusy(false); }
  }
  async function remove(scope: 'occurrence' | 'series') { if (!onDelete) return; setBusy(true); try { await onDelete(scope); onClose(); } finally { setBusy(false); } }
  function toggleWeekday(day: number) {
    setValue(current => ({ ...current, recurrenceWeekdays: current.recurrenceWeekdays.includes(day) ? current.recurrenceWeekdays.filter(item => item !== day) : [...current.recurrenceWeekdays, day].sort() }));
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog lesson-dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">РАСПИСАНИЕ</p><h2>{lesson ? 'Редактировать занятие' : 'Новое занятие'}</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <fieldset className="lesson-kind-options">
        <legend>Формат занятия</legend>
        {kindLabels.map(option => <label className={selectedKind === option.kind ? 'kind-option selected' : 'kind-option'} key={option.kind}>
          <input type="radio" name="lesson-kind" value={option.kind} checked={selectedKind === option.kind} onChange={() => selectKind(option.kind)} />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      <label>{selectedKind === 'individual' ? 'Ученик' : selectedKind === 'pair' ? 'Пара' : 'Группа'}<select value={value.groupId} onChange={e => setValue({ ...value, groupId: e.target.value })} required><option value="">{availableParticipants.length ? 'Выберите из списка' : `Сначала добавьте: ${selectedKind === 'individual' ? 'индивидуального ученика' : selectedKind === 'pair' ? 'пару' : 'группу'}`}</option>{availableParticipants.map(participant => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></label>
      <div className="form-grid three"><label>Дата<input type="date" value={value.date} onChange={e => setValue({ ...value, date: e.target.value })} required /></label><label>Начало<input type="time" value={value.startTime} onChange={e => setValue({ ...value, startTime: e.target.value })} required /></label><label>Конец<input type="time" value={value.endTime} onChange={e => setValue({ ...value, endTime: e.target.value })} required /></label></div>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Тема<input value={value.topic} onChange={e => setValue({ ...value, topic: e.target.value })} /></label></div>
      <div className="form-grid"><label>Юнит<input value={value.unit} onChange={e => setValue({ ...value, unit: e.target.value })} /></label><label>Урок<input value={value.lesson} onChange={e => setValue({ ...value, lesson: e.target.value })} /></label></div>
      <section className="recurrence-section">
        <label className="repeat-toggle"><input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} /><span>Повторять занятие</span></label>
        {repeats && <div className="recurrence-fields">
          <span className="field-caption">Дни недели</span>
          <div className="weekday-picker">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label, index) => <button type="button" className={value.recurrenceWeekdays.includes(index + 1) ? 'selected' : ''} onClick={() => toggleWeekday(index + 1)} key={label}>{label}</button>)}</div>
          {!value.recurrenceWeekdays.length && <small className="validation-hint">Выберите хотя бы один день</small>}
          <label>Повторять до<input type="date" min={value.date} value={value.recurrenceUntil} onChange={e => setValue({ ...value, recurrenceUntil: e.target.value })} required={repeats} /></label>
        </div>}
      </section>
      <label>Домашнее задание<textarea value={value.homework} onChange={e => setValue({ ...value, homework: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      {confirmDelete && <div className="delete-confirm lesson-delete-confirm" role="alert"><span>{lesson?.recurrenceWeekdays?.length ? 'Что нужно удалить?' : 'Точно удалить это занятие?'}</span><button type="button" className="ghost-button" onClick={() => setConfirmDelete(false)}>Отмена</button>{lesson?.recurrenceWeekdays?.length ? <><button type="button" className="danger-button" onClick={() => remove('occurrence')}>Только это занятие</button><button type="button" className="danger-button" onClick={() => remove('series')}>Всю серию</button></> : <button type="button" className="danger-button" onClick={() => remove('series')}>Да, удалить</button>}</div>}
      <footer>{onDelete && !confirmDelete && <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Удалить</button>}<span className="footer-spacer" /><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </div>;
}
