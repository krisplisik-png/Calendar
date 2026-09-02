import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Group, SchoolUser } from '../types';

export function TeacherAssignmentsDialog({ groups, teachers, onAssign, onSubstitute, onClose }: {
  groups: Group[]; teachers: SchoolUser[];
  onAssign: (group: Group, teacherId: string) => Promise<void>;
  onSubstitute: (group: Group, teacherId: string, dateFrom: string, dateTo: string) => Promise<number>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [groupId, setGroupId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [scope, setScope] = useState<'one' | 'period'>('one');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const group = groups.find(item => item.id === groupId);
    if (!group || !teacherId) return;
    setBusy(true); setMessage('');
    try {
      const count = await onSubstitute(group, teacherId, dateFrom, scope === 'one' ? dateFrom : dateTo);
      setMessage(count ? `Замена назначена: ${count} занят${count === 1 ? 'ие' : 'ия'}.` : 'В выбранные даты занятий нет.');
    } finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog teacher-dialog"><header><div><p className="eyebrow">ДОСТУП УЧИТЕЛЕЙ</p><h2>Учителя и замены</h2></div><button onClick={onClose}><X /></button></header>
    <p className="dialog-note">Основной учитель видит только закреплённые группы и занятия. При болезни или отпуске можно передать другому учителю одно занятие либо занятия за период.</p>
    {teachers.length ? <><h3 className="dialog-section-title">Основной учитель группы</h3><div className="assignment-list">{groups.map(group => <label key={group.id}><span><strong>{group.name}</strong><small>{group.kind === 'individual' ? 'Индивидуал' : group.kind === 'pair' ? 'Пара' : 'Группа'}</small></span><select value={group.teacherId ?? ''} onChange={event => onAssign(group, event.target.value)}><option value="">Не назначен</option>{teachers.map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.name || teacher.email}</option>)}</select></label>)}</div>
      <form className="substitute-form" onSubmit={submit}><h3>Временная замена</h3><div className="form-grid"><label>Группа<select value={groupId} onChange={event => setGroupId(event.target.value)} required><option value="">Выберите группу</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Заменяющий учитель<select value={teacherId} onChange={event => setTeacherId(event.target.value)} required><option value="">Выберите учителя</option>{teachers.filter(teacher => teacher.id !== groups.find(group => group.id === groupId)?.teacherId).map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.name || teacher.email}</option>)}</select></label></div>
        <fieldset className="substitute-scope"><legend>Срок замены</legend><label><input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} />Одно занятие</label><label><input type="radio" checked={scope === 'period'} onChange={() => setScope('period')} />Период</label></fieldset>
        <div className="form-grid"><label>{scope === 'one' ? 'Дата занятия' : 'С даты'}<input type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); if (scope === 'one' || event.target.value > dateTo) setDateTo(event.target.value); }} required /></label>{scope === 'period' && <label>По дату включительно<input type="date" min={dateFrom} value={dateTo} onChange={event => setDateTo(event.target.value)} required /></label>}</div>
        {message && <div className="success-note">{message}</div>}<button className="primary-button" disabled={busy || !groupId || !teacherId}>{busy ? 'Назначаем…' : 'Назначить замену'}</button>
      </form></> : <div className="journal-empty">Сначала создайте пользователя с ролью teacher в Firebase Authentication и коллекции users.</div>}
    <footer><span className="footer-spacer" /><button className="primary-button" onClick={onClose}>Готово</button></footer></section></div>;
}
