import { useMemo, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Search, Unlink, X } from 'lucide-react';
import type { Group, Lesson, ParentAccess, Student } from '../types';

interface SimpleGroupLink { id: string; fullName: string; studentId?: string; groupId: string; groupName: string }
const simpleLinksKey = 'calendar-simple-group-links';

function savedSimpleLinks(): SimpleGroupLink[] {
  try {
    const value = JSON.parse(localStorage.getItem(simpleLinksKey) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function ParentAccessDialog({ students, groups, lessons, access, syncing, syncError, onCreateStudent, onCreateSimpleLink, onCreateLink, onCreateMissingLink, onRename, onPrepare, onRegenerate, onDisable, onRebuild, onClose }: {
  students: Student[]; groups: Group[]; lessons: Lesson[]; access: ParentAccess[]; syncing?: boolean; syncError?: string;
  onCreateStudent: (name: string, groupIds: string[]) => Promise<void>;
  onCreateSimpleLink: (name: string, groupId: string) => Promise<string>;
  onCreateLink: (studentIds: string[]) => Promise<string>;
  onCreateMissingLink: (fullName: string, groupIds: string[]) => Promise<string>;
  onRename: (student: Student, fullName: string) => Promise<void>;
  onPrepare: (access: ParentAccess) => Promise<void>;
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
  const [createdNames, setCreatedNames] = useState<Set<string>>(new Set());
  const [simpleName, setSimpleName] = useState('');
  const [simpleGroupId, setSimpleGroupId] = useState('');
  const [simpleLinks, setSimpleLinks] = useState<SimpleGroupLink[]>(savedSimpleLinks);
  const studentMap = useMemo(() => new Map(students.map(student => [student.id, student])), [students]);
  const filteredAccess = useMemo(() => {
    const query = linkSearch.trim().toLocaleLowerCase('ru');
    const activeAccess = access.filter(item => item.active);
    const uniqueAccess = activeAccess.filter((item, index, items) => {
      const key = [...item.studentIds].sort().join('|');
      return items.findIndex(candidate => [...candidate.studentIds].sort().join('|') === key) === index;
    });
    if (!query) return uniqueAccess;
    return uniqueAccess.filter(item => item.studentIds.some(id => studentMap.get(id)?.fullName.toLocaleLowerCase('ru').includes(query)));
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
    return Array.from(candidates.entries()).filter(([key]) => query && key.includes(query) && !linkedNames.has(key) && !createdNames.has(key)).map(([, candidate]) => ({ ...candidate, groupIds: Array.from(candidate.groupIds) }));
  }, [students, lessons, access, studentMap, linkSearch, createdNames]);
  const urlFor = (token: string) => `${window.location.origin}${window.location.pathname}?parent=${encodeURIComponent(token)}`;
  const simpleUrlFor = (link: Pick<SimpleGroupLink, 'fullName' | 'studentId' | 'groupId' | 'groupName'>) => {
    const parameters = new URLSearchParams({ group: link.groupId, student: link.fullName, groupName: link.groupName, ...(link.studentId ? { studentId: link.studentId } : {}) });
    return `${window.location.origin}${window.location.pathname}?${parameters.toString()}`;
  };
  function saveSimpleLinks(next: SimpleGroupLink[]) { setSimpleLinks(next); localStorage.setItem(simpleLinksKey, JSON.stringify(next)); }
  async function createSimpleLink(event: FormEvent) {
    event.preventDefault();
    const fullName = simpleName.trim().replace(/\s+/g, ' ');
    const group = groups.find(item => item.id === simpleGroupId);
    if (!fullName || !group) return;
    setBusy(true); setOperationError('');
    try {
      const studentId = await onCreateSimpleLink(fullName, group.id);
      const link = { id: `${group.id}:${fullName.toLocaleLowerCase('ru')}`, fullName, studentId, groupId: group.id, groupName: group.name };
      const next = [...simpleLinks.filter(item => item.id !== link.id), link];
      saveSimpleLinks(next);
      await navigator.clipboard.writeText(simpleUrlFor(link));
      setNotice(`Простая ссылка для ${fullName} создана и скопирована`);
      setSimpleName(''); setSimpleGroupId('');
    } catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function addStudent(event: FormEvent) { event.preventDefault(); if (!name.trim() || !groupIds.length) return; setBusy(true); setOperationError(''); try { await onCreateStudent(name, groupIds); setNotice(`Ученик ${name.trim()} добавлен, родительская ссылка сохранена`); setName(''); setGroupIds([]); } catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function copy(token: string) { await navigator.clipboard.writeText(urlFor(token)); setNotice('Ссылка скопирована'); window.setTimeout(() => setNotice(''), 2200); }
  async function repair(item: ParentAccess) {
    setBusy(true); setOperationError('');
    try { await onPrepare(item); setNotice('Расписание по этой ссылке восстановлено'); }
    catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function rename(item: ParentAccess) {
    const linkedStudents = item.studentIds.map(id => studentMap.get(id)).filter((value): value is Student => Boolean(value));
    if (linkedStudents.length !== 1) {
      setOperationError('В общей семейной ссылке имя нужно исправить отдельно в карточке каждого ребёнка.');
      return;
    }
    const student = linkedStudents[0];
    const fullName = window.prompt('Исправьте фамилию или имя ребёнка:', student.fullName);
    if (fullName === null || !fullName.trim()) return;
    setBusy(true); setOperationError('');
    try {
      await onRename(student, fullName);
      setNotice(`Имя изменено на «${fullName.trim().replace(/\s+/g, ' ')}». Адрес родительской ссылки сохранён.`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  function openAndRepair(item: ParentAccess) {
    window.open(urlFor(item.token), '_blank', 'noopener,noreferrer');
    void onPrepare(item).catch(error => setOperationError(error instanceof Error ? error.message : String(error)));
  }
  async function createLink() { if (!selected.length) return; setBusy(true); try { const token = await onCreateLink(selected); await copy(token); setSelected([]); } finally { setBusy(false); } }
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog parent-access-dialog"><header><div><p className="eyebrow">РОДИТЕЛЬСКИЙ ДОСТУП</p><h2>Ученики и семейные ссылки</h2></div><button onClick={onClose}><X /></button></header>
    <div className="dialog-note">{syncing ? 'Находим детей в занятиях и создаём недостающие ссылки…' : 'Дети из списков групп и индивидуальных занятий добавляются автоматически. Для каждого ребёнка автоматически создаётся персональная ссылка.'}</div>
    <form className="simple-group-link-form" onSubmit={createSimpleLink}><div><h3>Простая ссылка на расписание группы</h3><p>Введите ребёнка и выберите группу. Такая ссылка открывается без персональной базы Firebase.</p></div><label>Фамилия и имя<input list="simple-parent-students" value={simpleName} onChange={event => setSimpleName(event.target.value)} placeholder="Романенко Юлия" /></label><datalist id="simple-parent-students">{students.filter(student => student.active !== false).map(student => <option value={student.fullName} key={student.id} />)}</datalist><label>Группа<select value={simpleGroupId} onChange={event => setSimpleGroupId(event.target.value)}><option value="">Выберите группу</option>{groups.filter(group => (group.kind ?? 'group') === 'group').map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><button className="primary-button" disabled={busy || !simpleName.trim() || !simpleGroupId}><Link2 size={16} />{busy ? 'Создаём…' : 'Создать и скопировать простую ссылку'}</button>{simpleLinks.length > 0 && <div className="simple-group-links">{simpleLinks.map(link => <article key={link.id}><div><strong>{link.fullName}</strong><small>{link.groupName}</small></div><button type="button" title="Скопировать" onClick={() => navigator.clipboard.writeText(simpleUrlFor(link))}><Copy size={16} /></button><button type="button" title="Открыть" onClick={() => window.open(simpleUrlFor(link), '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></button><button type="button" className="link-danger" title="Убрать из списка" onClick={() => saveSimpleLinks(simpleLinks.filter(item => item.id !== link.id))}><X size={16} /></button></article>)}</div>}</form>
    {syncError && <div className="form-error" role="alert">Не удалось обновить родительские ссылки: {syncError}</div>}
    {operationError && <div className="form-error" role="alert">Не удалось выполнить действие: {operationError}</div>}
    {notice && <div className="success-note">{notice}</div>}
    <details className="manual-parent-tools"><summary>Дополнительные действия (необязательно)</summary><form className="student-create-form" onSubmit={addStudent}><h3>Добавить ученика вручную</h3><label>Фамилия и имя<input value={name} onChange={event => setName(event.target.value)} placeholder="Например: Мария Петрова" /></label><fieldset><legend>Прикрепить к занятиям</legend>{groups.map(group => <label key={group.id}><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => setGroupIds(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} />{group.name}</label>)}</fieldset><button className="ghost-button" disabled={busy || !name.trim() || !groupIds.length}><Plus size={16} />Добавить ученика</button></form><section className="family-link-create"><h3>Общая ссылка для нескольких детей</h3><p>Используйте, только если одной семье нужна одна ссылка для нескольких детей.</p><div>{students.map(student => <label key={student.id}><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])} /><span>{student.fullName}<small>{student.groupIds.map(id => groups.find(group => group.id === id)?.name).filter(Boolean).join(', ')}</small></span></label>)}</div><button className="primary-button" onClick={createLink} disabled={busy || !selected.length}><Link2 size={16} />Создать и скопировать общую ссылку</button></section></details>
    <section className="parent-links"><h3>Созданные ссылки</h3><label className="parent-link-search"><Search size={17} /><input type="search" value={linkSearch} onChange={event => setLinkSearch(event.target.value)} placeholder="Найти ребенка по имени или фамилии" aria-label="Поиск ребенка в созданных ссылках" />{linkSearch && <button type="button" onClick={() => setLinkSearch('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>{filteredAccess.map(item => <article key={item.id}><div><strong>{item.studentIds.map(id => studentMap.get(id)?.fullName).filter(Boolean).join(' · ') || 'Ученик не найден'}</strong><small>Доступ активен</small></div><button title="Исправить фамилию или имя" disabled={busy} onClick={() => rename(item)}><Pencil size={16} /></button><button title="Скопировать" disabled={busy} onClick={() => copy(item.token)}><Copy size={16} /></button><button title="Открыть" disabled={busy} onClick={() => openAndRepair(item)}><ExternalLink size={16} /></button><button title="Восстановить расписание по этой ссылке" disabled={busy} onClick={() => repair(item)}><RefreshCw size={16} /></button><button className="link-danger" title="Отключить" disabled={busy} onClick={() => onDisable(item)}><Unlink size={16} /></button></article>)}{scheduleCandidates.map(candidate => <article className="missing-parent-link" key={candidate.fullName}><div><strong>{candidate.fullName}</strong><small>Родительская ссылка еще не создана</small></div><button className="create-missing-link" disabled={busy} onClick={async () => { setBusy(true); setOperationError(''); try { await onCreateMissingLink(candidate.fullName, candidate.groupIds); setCreatedNames(current => new Set(current).add(candidate.fullName.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е'))); setNotice(`Ссылка для ${candidate.fullName} создана и сохранена`); } catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }}><Link2 size={15} />{busy ? 'Сохраняем…' : 'Создать и сохранить ссылку'}</button></article>)}{!filteredAccess.length && !scheduleCandidates.length && <p className="journal-empty">{linkSearch ? 'Ученик с таким именем не найден ни в ссылках, ни в занятиях.' : access.length ? 'Введите имя или фамилию ребенка.' : 'Родительских ссылок пока нет.'}</p>}</section>
    <footer><button className="ghost-button" disabled={busy} onClick={async () => { setBusy(true); try { await onRebuild(); setNotice('Родительские расписания обновлены'); } finally { setBusy(false); } }}><RefreshCw size={16} />Обновить расписания</button><span className="footer-spacer" /><button className="primary-button" onClick={onClose}>Готово</button></footer>
  </section></div>;
}
