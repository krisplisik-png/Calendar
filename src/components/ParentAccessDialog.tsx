import { useMemo, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Link2, Plus, RefreshCw, Search, Unlink, X } from 'lucide-react';
import type { Group, Lesson, ParentAccess, Student } from '../types';

export function ParentAccessDialog({ students, groups, lessons, access, syncing, syncError, onCreateStudent, onCreateLink, onCreateMissingLink, onRegenerate, onDisable, onRebuild, onClose }: {
  students: Student[]; groups: Group[]; lessons: Lesson[]; access: ParentAccess[]; syncing?: boolean; syncError?: string;
  onCreateStudent: (name: string, groupIds: string[]) => Promise<void>;
  onCreateLink: (studentIds: string[]) => Promise<string>;
  onCreateMissingLink: (fullName: string, groupIds: string[]) => Promise<string>;
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
  const [operationError, setOperationError] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const studentMap = useMemo(() => new Map(students.map(student => [student.id, student])), [students]);
  const filteredAccess = useMemo(() => {
    const query = linkSearch.trim().toLocaleLowerCase('ru');
    const activeAccess = access.filter(item => item.active);
    if (!query) return activeAccess;
    return activeAccess.filter(item => item.studentIds.some(id => studentMap.get(id)?.fullName.toLocaleLowerCase('ru').includes(query)));
  }, [access, linkSearch, studentMap]);
  const scheduleCandidates = useMemo(() => {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
    const candidates = new Map<string, { fullName: string; groupIds: Set<string> }>();
    students.filter(student => student.active !== false).forEach(student => {
      candidates.set(normalize(student.fullName), { fullName: student.fullName.trim(), groupIds: new Set(student.groupIds) });
    });
    lessons.forEach(lesson => lesson.studentRoster?.forEach(student => {
      if (!student.fullName.trim()) return;
      const key = normalize(student.fullName);
      const candidate = candidates.get(key) ?? { fullName: student.fullName.trim(), groupIds: new Set<string>() };
      candidate.groupIds.add(lesson.groupId);
      candidates.set(key, candidate);
    }));
    const linkedNames = new Set(access.filter(item => item.active).flatMap(item => item.studentIds.map(id => studentMap.get(id)?.fullName).filter((value): value is string => Boolean(value)).map(normalize)));
    const query = normalize(linkSearch);
    return Array.from(candidates.entries()).filter(([key]) => query && key.includes(query) && !linkedNames.has(key)).map(([, candidate]) => ({ ...candidate, groupIds: Array.from(candidate.groupIds) }));
  }, [students, lessons, access, studentMap, linkSearch]);
  const urlFor = (token: string) => `${window.location.origin}${window.location.pathname}?parent=${encodeURIComponent(token)}`;
  async function addStudent(event: FormEvent) { event.preventDefault(); if (!name.trim() || !groupIds.length) return; setBusy(true); setOperationError(''); try { await onCreateStudent(name, groupIds); setNotice(`Ученик ${name.trim()} добавлен, родительская ссылка сохранена`); setName(''); setGroupIds([]); } catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function copy(token: string) { await navigator.clipboard.writeText(urlFor(token)); setNotice('Ссылка скопирована'); window.setTimeout(() => setNotice(''), 2200); }
  async function createLink() { if (!selected.length) return; setBusy(true); try { const token = await onCreateLink(selected); await copy(token); setSelected([]); } finally { setBusy(false); } }
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog parent-access-dialog"><header><div><p className="eyebrow">РОДИТЕЛЬСКИЙ ДОСТУП</p><h2>Ученики и семейные ссылки</h2></div><button onClick={onClose}><X /></button></header>
    <div className="dialog-note">{syncing ? 'Находим детей в занятиях и создаём недостающие ссылки…' : 'Дети из списков групп и индивидуальных занятий добавляются автоматически. Для каждого ребёнка автоматически создаётся персональная ссылка.'}</div>
    {syncError && <div className="form-error" role="alert">Не удалось обновить родительские ссылки: {syncError}</div>}
    {operationError && <div className="form-error" role="alert">Не удалось добавить ученика: {operationError}</div>}
    {notice && <div className="success-note">{notice}</div>}
    <details className="manual-parent-tools"><summary>Дополнительные действия (необязательно)</summary><form className="student-create-form" onSubmit={addStudent}><h3>Добавить ученика вручную</h3><label>Фамилия и имя<input value={name} onChange={event => setName(event.target.value)} placeholder="Например: Мария Петрова" /></label><fieldset><legend>Прикрепить к занятиям</legend>{groups.map(group => <label key={group.id}><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => setGroupIds(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} />{group.name}</label>)}</fieldset><button className="ghost-button" disabled={busy || !name.trim() || !groupIds.length}><Plus size={16} />Добавить ученика</button></form><section className="family-link-create"><h3>Общая ссылка для нескольких детей</h3><p>Используйте, только если одной семье нужна одна ссылка для нескольких детей.</p><div>{students.map(student => <label key={student.id}><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])} /><span>{student.fullName}<small>{student.groupIds.map(id => groups.find(group => group.id === id)?.name).filter(Boolean).join(', ')}</small></span></label>)}</div><button className="primary-button" onClick={createLink} disabled={busy || !selected.length}><Link2 size={16} />Создать и скопировать общую ссылку</button></section></details>
    <section className="parent-links"><h3>Созданные ссылки</h3><label className="parent-link-search"><Search size={17} /><input type="search" value={linkSearch} onChange={event => setLinkSearch(event.target.value)} placeholder="Найти ребенка по имени или фамилии" aria-label="Поиск ребенка в созданных ссылках" />{linkSearch && <button type="button" onClick={() => setLinkSearch('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>{filteredAccess.map(item => <article key={item.id}><div><strong>{item.studentIds.map(id => studentMap.get(id)?.fullName).filter(Boolean).join(' · ') || 'Ученик не найден'}</strong><small>Доступ активен</small></div><button title="Скопировать" onClick={() => copy(item.token)}><Copy size={16} /></button><button title="Открыть" onClick={() => window.open(urlFor(item.token), '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></button><button title="Создать новую ссылку" onClick={async () => { setBusy(true); try { await copy(await onRegenerate(item)); } finally { setBusy(false); } }}><RefreshCw size={16} /></button><button className="link-danger" title="Отключить" onClick={() => onDisable(item)}><Unlink size={16} /></button></article>)}{scheduleCandidates.map(candidate => <article className="missing-parent-link" key={candidate.fullName}><div><strong>{candidate.fullName}</strong><small>Родительская ссылка еще не создана</small></div><button className="create-missing-link" disabled={busy} onClick={async () => { setBusy(true); try { const token = await onCreateMissingLink(candidate.fullName, candidate.groupIds); await copy(token); setNotice(`Ссылка для ${candidate.fullName} создана, сохранена и скопирована`); } finally { setBusy(false); } }}><Link2 size={15} />Создать и сохранить ссылку</button></article>)}{!filteredAccess.length && !scheduleCandidates.length && <p className="journal-empty">{linkSearch ? 'Ученик с таким именем не найден ни в ссылках, ни в занятиях.' : access.length ? 'Введите имя или фамилию ребенка.' : 'Родительских ссылок пока нет.'}</p>}</section>
    <footer><button className="ghost-button" disabled={busy} onClick={async () => { setBusy(true); try { await onRebuild(); setNotice('Родительские расписания обновлены'); } finally { setBusy(false); } }}><RefreshCw size={16} />Обновить расписания</button><span className="footer-spacer" /><button className="primary-button" onClick={onClose}>Готово</button></footer>
  </section></div>;
}
