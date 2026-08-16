import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Group, Lesson } from '../types';

export interface LessonInput {
  groupId: string; date: string; startTime: string; endTime: string;
  course: string; unit: string; lesson: string; topic: string; homework: string; notes: string;
}

const empty = (): LessonInput => ({ groupId: '', date: new Date().toISOString().slice(0, 10), startTime: '10:00', endTime: '11:00', course: '', unit: '', lesson: '', topic: '', homework: '', notes: '' });

export function LessonDialog({ groups, lesson, initialDate, onClose, onSave, onDelete }: {
  groups: Group[]; lesson: Lesson | null; initialDate?: string; onClose: () => void;
  onSave: (value: LessonInput) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const groupKinds = [
    { kind: 'group', label: 'Группы' },
    { kind: 'pair', label: 'Пары' },
    { kind: 'individual', label: 'Индивидуально' },
  ] as const;
  const [value, setValue] = useState<LessonInput>(empty());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setValue(lesson ? {
    groupId: lesson.groupId, date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime,
    course: lesson.course ?? '', unit: lesson.unit ?? '', lesson: lesson.lesson ?? '', topic: lesson.topic ?? '', homework: lesson.homework ?? '', notes: lesson.notes ?? '',
  } : { ...empty(), groupId: groups[0]?.id ?? '', date: initialDate ?? empty().date }), [lesson, groups, initialDate]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onSave(value); onClose(); } finally { setBusy(false); }
  }
  async function remove() { if (!onDelete) return; setBusy(true); try { await onDelete(); onClose(); } finally { setBusy(false); } }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog lesson-dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">РАСПИСАНИЕ</p><h2>{lesson ? 'Редактировать занятие' : 'Новое занятие'}</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <label>Ученик или группа<select value={value.groupId} onChange={e => setValue({ ...value, groupId: e.target.value })} required><option value="">Выберите ученика или группу</option>{groupKinds.map(section => {
        const options = groups.filter(group => (group.kind ?? 'group') === section.kind);
        return options.length ? <optgroup label={section.label} key={section.kind}>{options.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</optgroup> : null;
      })}</select></label>
      <div className="form-grid three"><label>Дата<input type="date" value={value.date} onChange={e => setValue({ ...value, date: e.target.value })} required /></label><label>Начало<input type="time" value={value.startTime} onChange={e => setValue({ ...value, startTime: e.target.value })} required /></label><label>Конец<input type="time" value={value.endTime} onChange={e => setValue({ ...value, endTime: e.target.value })} required /></label></div>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Тема<input value={value.topic} onChange={e => setValue({ ...value, topic: e.target.value })} /></label></div>
      <div className="form-grid"><label>Юнит<input value={value.unit} onChange={e => setValue({ ...value, unit: e.target.value })} /></label><label>Урок<input value={value.lesson} onChange={e => setValue({ ...value, lesson: e.target.value })} /></label></div>
      <label>Домашнее задание<textarea value={value.homework} onChange={e => setValue({ ...value, homework: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      {confirmDelete && <div className="delete-confirm" role="alert"><span>Точно удалить это занятие?</span><button type="button" className="ghost-button" onClick={() => setConfirmDelete(false)}>Нет</button><button type="button" className="danger-button" onClick={remove}>Да, удалить</button></div>}
      <footer>{onDelete && !confirmDelete && <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Удалить</button>}<span className="footer-spacer" /><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </div>;
}
