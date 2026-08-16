import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { GroupKind } from '../types';

export interface GroupInput { name: string; kind: GroupKind; color: string; course: string; level: string; notes: string }

export function GroupDialog({ onClose, onSave }: { onClose: () => void; onSave: (value: GroupInput) => Promise<void> }) {
  const [value, setValue] = useState<GroupInput>({ name: '', kind: 'group', color: '#a98be8', course: '', level: '', notes: '' });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onSave(value); onClose(); } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">НОВАЯ ЗАПИСЬ</p><h2>Добавить ученика или группу</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <label>Формат<select value={value.kind} onChange={e => setValue({ ...value, kind: e.target.value as GroupKind })}><option value="group">Группа</option><option value="pair">Пара</option><option value="individual">Индивидуально</option></select></label>
      <label>{value.kind === 'group' ? 'Название группы' : value.kind === 'pair' ? 'Имена учеников' : 'Имя ученика'}<input value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder={value.kind === 'pair' ? 'Например: Анна и Мария' : value.kind === 'individual' ? 'Например: Анна Петрова' : 'Например: Английский A1'} required autoFocus /></label>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Уровень<input value={value.level} onChange={e => setValue({ ...value, level: e.target.value })} /></label></div>
      <label>Цвет<input className="color-input" type="color" value={value.color} onChange={e => setValue({ ...value, color: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      <footer><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Добавить'}</button></footer>
    </form>
  </div>;
}
