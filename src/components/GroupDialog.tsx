import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

export interface GroupInput { name: string; color: string; course: string; level: string; notes: string }

export function GroupDialog({ onClose, onSave }: { onClose: () => void; onSave: (value: GroupInput) => Promise<void> }) {
  const [value, setValue] = useState<GroupInput>({ name: '', color: '#a98be8', course: '', level: '', notes: '' });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await onSave(value); onClose(); } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">НОВАЯ ЗАПИСЬ</p><h2>Добавить группу</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <label>Название<input value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} required autoFocus /></label>
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Уровень<input value={value.level} onChange={e => setValue({ ...value, level: e.target.value })} /></label></div>
      <label>Цвет<input className="color-input" type="color" value={value.color} onChange={e => setValue({ ...value, color: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      <footer><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Создать группу'}</button></footer>
    </form>
  </div>;
}
