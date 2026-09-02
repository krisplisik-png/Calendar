import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Group, GroupKind } from '../types';

export interface GroupInput { name: string; kind: GroupKind; color: string; course: string; level: string; notes: string; monthlyLessonTarget: 6 | 7 | 8 | 9 | 10; subscriptionLessonPrice: number; singleLessonPrice: number }

export function GroupDialog({ group, onClose, onSave }: { group?: Group | null; onClose: () => void; onSave: (value: GroupInput) => Promise<void> }) {
  const [value, setValue] = useState<GroupInput>(() => group ? { name: group.name, kind: group.kind ?? 'group', color: group.color, course: group.course ?? '', level: group.level ?? '', notes: group.notes ?? '', monthlyLessonTarget: group.monthlyLessonTarget ?? 8, subscriptionLessonPrice: group.subscriptionLessonPrice ?? 0, singleLessonPrice: group.singleLessonPrice ?? 0 } : { name: '', kind: 'group', color: '#a98be8', course: '', level: '', notes: '', monthlyLessonTarget: 8, subscriptionLessonPrice: 0, singleLessonPrice: 0 });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onSave(value); onClose(); } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">{group ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАПИСЬ'}</p><h2>{group ? 'Изменить ученика или группу' : 'Добавить ученика или группу'}</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <label>Формат<select value={value.kind} onChange={e => setValue({ ...value, kind: e.target.value as GroupKind })}><option value="group">Группа</option><option value="pair">Пара</option><option value="individual">Индивидуально</option></select></label>
      <label>{value.kind === 'group' ? 'Название группы' : value.kind === 'pair' ? 'Имена учеников' : 'Имя ученика'}<input value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder={value.kind === 'pair' ? 'Например: Анна и Мария' : value.kind === 'individual' ? 'Например: Анна Петрова' : 'Например: Английский A1'} required autoFocus /></label>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Уровень<input value={value.level} onChange={e => setValue({ ...value, level: e.target.value })} /></label></div>
      <label>Количество уроков в месяц<select value={value.monthlyLessonTarget} onChange={e => setValue({ ...value, monthlyLessonTarget: Number(e.target.value) as GroupInput['monthlyLessonTarget'] })}>{[6, 7, 8, 9, 10].map(count => <option value={count} key={count}>{count} уроков</option>)}</select></label>
      <div className="form-grid"><label>Цена урока по абонементу<input type="number" min="0" step="50" value={value.subscriptionLessonPrice || ''} onChange={e => setValue({ ...value, subscriptionLessonPrice: Number(e.target.value) })} placeholder="Например, 900" /></label><label>Цена разового урока<input type="number" min="0" step="50" value={value.singleLessonPrice || ''} onChange={e => setValue({ ...value, singleLessonPrice: Number(e.target.value) })} placeholder="Например, 1200" /></label></div>
      <label>Цвет<input className="color-input" type="color" value={value.color} onChange={e => setValue({ ...value, color: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      <footer><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : group ? 'Сохранить изменения' : 'Добавить'}</button></footer>
    </form>
  </div>;
}
