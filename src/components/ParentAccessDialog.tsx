import { useMemo, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Link2, Plus, RefreshCw, Unlink, X } from 'lucide-react';
import type { Group, ParentAccess, Student } from '../types';

export function ParentAccessDialog({ students, groups, access, onCreateStudent, onCreateLink, onRegenerate, onDisable, onRebuild, onClose }: {
  students: Student[]; groups: Group[]; access: ParentAccess[];
  onCreateStudent: (name: string, groupIds: string[]) => Promise<void>;
  onCreateLink: (studentIds: string[]) => Promise<string>;
  onRegenerate: (access: ParentAccess) => Promise<string>;
  onDisable: (access: ParentAccess) => Promise<void>;
  onRebuild: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const studentMap = useMemo(() => new Map(students.map(student => [student.id, student])), [students]);
  const urlFor = (token: string) => `${window.location.origin}${window.location.pathname}?parent=${encodeURIComponent(token)}`;
  async function addStudent(event: FormEvent) { event.preventDefault(); if (!name.trim() || !groupIds.length) return; setBusy(true); try { await onCreateStudent(name, groupIds); setName(''); setGroupIds([]); } finally { setBusy(false); } }
  async function copy(token: string) { await navigator.clipboard.writeText(urlFor(token)); setNotice('Ссылка скопирована'); window.setTimeout(() => setNotice(''), 2200); }
  async function createLink() { if (!selected.length) return; setBusy(true); try { const token = await onCreateLink(selected); await copy(token); setSelected([]); } finally { setBusy(false); } }
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog parent-access-dialog"><header><div><p className="eyebrow">РОДИТЕЛЬСКИЙ ДОСТУП</p><h2>Ученики и семейные ссылки</h2></div><button onClick={onClose}><X /></button></header>
    {notice && <div className="success-note">{notice}</div>}
    <form className="student-create-form" onSubmit={addStudent}><h3>Новый ученик</h3><label>Фамилия и имя<input value={name} onChange={event => setName(event.target.value)} placeholder="Например: Мария Петрова" /></label><fieldset><legend>Прикрепить к занятиям</legend>{groups.map(group => <label key={group.id}><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => setGroupIds(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} />{group.name}</label>)}</fieldset><button className="ghost-button" disabled={busy || !name.trim() || !groupIds.length}><Plus size={16} />Добавить ученика</button></form>
    <section className="family-link-create"><h3>Создать ссылку для семьи</h3><p>Можно выбрать одного или нескольких детей одной семьи.</p><div>{students.map(student => <label key={student.id}><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])} /><span>{student.fullName}<small>{student.groupIds.map(id => groups.find(group => group.id === id)?.name).filter(Boolean).join(', ')}</small></span></label>)}</div><button className="primary-button" onClick={createLink} disabled={busy || !selected.length}><Link2 size={16} />Создать и скопировать ссылку</button></section>
    <section className="parent-links"><h3>Созданные ссылки</h3>{access.length ? access.map(item => <article key={item.id}><div><strong>{item.studentIds.map(id => studentMap.get(id)?.fullName).filter(Boolean).join(' · ') || 'Ученик не найден'}</strong><small>{item.active ? 'Доступ активен' : 'Доступ отключён'}</small></div>{item.active && <><button title="Скопировать" onClick={() => copy(item.token)}><Copy size={16} /></button><button title="Открыть" onClick={() => window.open(urlFor(item.token), '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></button><button title="Создать новую ссылку" onClick={async () => { setBusy(true); try { await copy(await onRegenerate(item)); } finally { setBusy(false); } }}><RefreshCw size={16} /></button><button className="link-danger" title="Отключить" onClick={() => onDisable(item)}><Unlink size={16} /></button></>}</article>) : <p className="journal-empty">Родительских ссылок пока нет.</p>}</section>
    <footer><button className="ghost-button" disabled={busy} onClick={async () => { setBusy(true); try { await onRebuild(); setNotice('Родительские расписания обновлены'); } finally { setBusy(false); } }}><RefreshCw size={16} />Обновить расписания</button><span className="footer-spacer" /><button className="primary-button" onClick={onClose}>Готово</button></footer>
  </section></div>;
}
