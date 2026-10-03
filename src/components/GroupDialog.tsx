import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Group, GroupKind } from '../types';
import { pairStudentNames } from '../domain/groupStudents';

export interface GroupInput { name: string; kind: GroupKind; studentNames: string[]; color: string; course: string; level: string; notes: string; monthlyLessonTarget: 3 | 4 | 6 | 7 | 8 | 9 | 10; subscriptionLessonPrice: number; singleLessonPrice: number }

export function GroupDialog({ group, onClose, onSave }: { group?: Group | null; onClose: () => void; onSave: (value: GroupInput) => Promise<void> }) {
  const [value, setValue] = useState<GroupInput>(() => group ? { name: group.name, kind: group.kind ?? 'group', studentNames: [...pairStudentNames(group), '', ''].slice(0, 2), color: group.color, course: group.course ?? '', level: group.level ?? '', notes: group.notes ?? '', monthlyLessonTarget: group.monthlyLessonTarget ?? 8, subscriptionLessonPrice: group.subscriptionLessonPrice ?? 0, singleLessonPrice: group.singleLessonPrice ?? 0 } : { name: '', kind: 'group', studentNames: ['', ''], color: '#a98be8', course: '', level: '', notes: '', monthlyLessonTarget: 8, subscriptionLessonPrice: 0, singleLessonPrice: 0 });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaveError('');
    const cleanStudentNames = value.studentNames.map(name => name.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (value.kind === 'pair' && cleanStudentNames.length !== 2) {
      setSaveError('Для пары заполните фамилию и имя каждого из двух учеников.');
      return;
    }
    if (value.kind === 'pair' && cleanStudentNames[0].toLocaleLowerCase('ru') === cleanStudentNames[1].toLocaleLowerCase('ru')) {
      setSaveError('В паре должны быть указаны два разных ученика.');
      return;
    }
    setBusy(true);
    try {
      await onSave({
        ...value,
        name: value.kind === 'pair' ? cleanStudentNames.join(' и ') : value.name.trim().replace(/\s+/g, ' '),
        studentNames: value.kind === 'pair' ? cleanStudentNames : [],
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить. Попробуйте ещё раз.');
    } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="dialog" onSubmit={submit}>
      <header><div><p className="eyebrow">{group ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАПИСЬ'}</p><h2>{group ? 'Изменить ученика, пару или группу' : 'Добавить ученика, пару или группу'}</h2></div><button type="button" onClick={onClose}><X /></button></header>
      <label>Формат<select value={value.kind} onChange={e => setValue({ ...value, kind: e.target.value as GroupKind })}><option value="group">Группа</option><option value="pair">Пара</option><option value="individual">Индивидуально</option></select></label>
      {value.kind === 'pair'
        ? <div className="form-grid"><label>Первый ученик<input value={value.studentNames[0] ?? ''} onChange={e => setValue({ ...value, studentNames: [e.target.value, value.studentNames[1] ?? ''] })} placeholder="Меркучев Никита" required autoFocus /></label><label>Второй ученик<input value={value.studentNames[1] ?? ''} onChange={e => setValue({ ...value, studentNames: [value.studentNames[0] ?? '', e.target.value] })} placeholder="Казанцев Артем" required /></label></div>
        : <label>{value.kind === 'group' ? 'Название группы' : 'Имя ученика'}<input value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} placeholder={value.kind === 'individual' ? 'Например: Анна Петрова' : 'Например: Английский A1'} required autoFocus /></label>}
      <div className="form-grid"><label>Курс<input value={value.course} onChange={e => setValue({ ...value, course: e.target.value })} /></label><label>Уровень<input value={value.level} onChange={e => setValue({ ...value, level: e.target.value })} /></label></div>
      <label>Количество уроков в месяц<select value={value.monthlyLessonTarget} onChange={e => setValue({ ...value, monthlyLessonTarget: Number(e.target.value) as GroupInput['monthlyLessonTarget'] })}>{[3, 4, 6, 7, 8, 9, 10].map(count => <option value={count} key={count}>{count} {count < 5 ? 'урока' : 'уроков'}</option>)}</select></label>
      <div className="form-grid"><label>Цена урока по абонементу<input type="number" min="0" step="50" value={value.subscriptionLessonPrice || ''} onChange={e => setValue({ ...value, subscriptionLessonPrice: Number(e.target.value) })} placeholder="Например, 900" /></label><label>Цена разового урока<input type="number" min="0" step="50" value={value.singleLessonPrice || ''} onChange={e => setValue({ ...value, singleLessonPrice: Number(e.target.value) })} placeholder="Например, 1200" /></label></div>
      <label>Цвет<input className="color-input" type="color" value={value.color} onChange={e => setValue({ ...value, color: e.target.value })} /></label>
      <label>Заметки<textarea value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })} /></label>
      {saveError && <div className="form-error" role="alert">{saveError}</div>}
      <footer><button type="button" className="ghost-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : group ? 'Сохранить изменения' : 'Добавить'}</button></footer>
    </form>
  </div>;
}
