import { useMemo, useState, type FormEvent } from 'react';
import { Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Search, Unlink, X } from 'lucide-react';
import type { Group, Lesson, ParentAccess, Student } from '../types';

interface SimpleGroupLink {
  id: string;
  fullName: string;
  studentId?: string;
  groupId: string;
  groupName: string;
}

const simpleLinksKey = 'calendar-simple-group-links';
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');

function savedSimpleLinks(): SimpleGroupLink[] {
  try {
    const value = JSON.parse(localStorage.getItem(simpleLinksKey) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function ParentAccessDialog({ students, groups, lessons, access, syncing, syncError, onCreateStudent, onCreateSimpleLink, onRename, onPrepare, onDisable, onRebuild, onClose }: {
  students: Student[];
  groups: Group[];
  lessons: Lesson[];
  access: ParentAccess[];
  syncing?: boolean;
  syncError?: string;
  onCreateStudent: (name: string, groupIds: string[]) => Promise<unknown>;
  onCreateSimpleLink: (name: string, groupId: string) => Promise<string>;
  onRename: (student: Student, fullName: string) => Promise<void>;
  onPrepare: (access: ParentAccess) => Promise<void>;
  onDisable: (access: ParentAccess) => Promise<void>;
  onRebuild: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [operationError, setOperationError] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [simpleSearch, setSimpleSearch] = useState('');
  const [simpleName, setSimpleName] = useState('');
  const [simpleGroupId, setSimpleGroupId] = useState('');
  const [manualSimpleLinks, setManualSimpleLinks] = useState<SimpleGroupLink[]>(savedSimpleLinks);

  const studentMap = useMemo(() => new Map(students.map(student => [student.id, student])), [students]);
  const groupMap = useMemo(() => new Map(groups.filter(group => (group.kind ?? 'group') === 'group').map(group => [group.id, group])), [groups]);

  const automaticSimpleLinks = useMemo(() => {
    const result = new Map<string, SimpleGroupLink>();
    const rosterByGroupAndName = new Map<string, { id: string; fullName: string }>();

    lessons.forEach(lesson => lesson.studentRoster?.forEach(student => {
      if (!student.fullName.trim() || !groupMap.has(lesson.groupId)) return;
      rosterByGroupAndName.set(`${lesson.groupId}:${normalizeName(student.fullName)}`, student);
    }));

    students.filter(student => student.active !== false).forEach(student => student.groupIds.forEach(groupId => {
      const group = groupMap.get(groupId);
      if (!group) return;
      const key = `${groupId}:${normalizeName(student.fullName)}`;
      const rosterStudent = rosterByGroupAndName.get(key);
      result.set(key, {
        id: key,
        fullName: student.fullName.trim(),
        studentId: rosterStudent?.id ?? student.id,
        groupId,
        groupName: group.name,
      });
    }));

    // Some older groups contain the membership only in group.studentIds,
    // while newer records also keep it in student.groupIds. Read both forms.
    groupMap.forEach(group => (group.studentIds ?? []).forEach(studentId => {
      const student = students.find(item => item.id === studentId && item.active !== false);
      if (!student) return;
      const key = `${group.id}:${normalizeName(student.fullName)}`;
      if (result.has(key)) return;
      const rosterStudent = rosterByGroupAndName.get(key);
      result.set(key, {
        id: key,
        fullName: student.fullName.trim(),
        studentId: rosterStudent?.id ?? student.id,
        groupId: group.id,
        groupName: group.name,
      });
    }));

    rosterByGroupAndName.forEach((student, key) => {
      if (result.has(key)) return;
      const groupId = key.slice(0, key.indexOf(':'));
      const group = groupMap.get(groupId);
      if (!group) return;
      result.set(key, { id: key, fullName: student.fullName.trim(), studentId: student.id, groupId, groupName: group.name });
    });

    return Array.from(result.values()).sort((a, b) => `${a.fullName}${a.groupName}`.localeCompare(`${b.fullName}${b.groupName}`, 'ru'));
  }, [students, lessons, groupMap]);

  const simpleLinks = useMemo(() => {
    const result = new Map(manualSimpleLinks.map(link => [link.id, link]));
    automaticSimpleLinks.forEach(link => result.set(link.id, link));
    return Array.from(result.values()).sort((a, b) => `${a.fullName}${a.groupName}`.localeCompare(`${b.fullName}${b.groupName}`, 'ru'));
  }, [automaticSimpleLinks, manualSimpleLinks]);

  const filteredSimpleLinks = useMemo(() => {
    const query = normalizeName(simpleSearch);
    return query ? simpleLinks.filter(link => normalizeName(`${link.fullName} ${link.groupName}`).includes(query)) : simpleLinks;
  }, [simpleLinks, simpleSearch]);

  const filteredAccess = useMemo(() => {
    const query = normalizeName(linkSearch);
    const activeAccess = access.filter(item => item.active);
    const uniqueAccess = activeAccess.filter((item, index, items) => {
      const key = [...item.studentIds].sort().join('|');
      return items.findIndex(candidate => [...candidate.studentIds].sort().join('|') === key) === index;
    });
    if (!query) return uniqueAccess;
    return uniqueAccess.filter(item => item.studentIds.some(id => normalizeName(studentMap.get(id)?.fullName ?? '').includes(query)));
  }, [access, linkSearch, studentMap]);

  const urlFor = (token: string) => `${window.location.origin}${window.location.pathname}?parent=${encodeURIComponent(token)}`;
  const simpleUrlFor = (link: Pick<SimpleGroupLink, 'fullName' | 'studentId' | 'groupId' | 'groupName'>) => {
    const parameters = new URLSearchParams({
      group: link.groupId,
      student: link.fullName,
      groupName: link.groupName,
      ...(link.studentId ? { studentId: link.studentId } : {}),
    });
    return `${window.location.origin}${window.location.pathname}?${parameters.toString()}`;
  };

  function saveManualSimpleLink(link: SimpleGroupLink) {
    setManualSimpleLinks(current => {
      const updated = [...current.filter(item => item.id !== link.id), link];
      localStorage.setItem(simpleLinksKey, JSON.stringify(updated));
      return updated;
    });
  }

  function prepareSimpleLink(link: SimpleGroupLink) {
    void onCreateSimpleLink(link.fullName, link.groupId).catch(error => {
      setOperationError(`Ссылка уже готова, но обновить данные группы не удалось: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async function copySimpleLink(link: SimpleGroupLink) {
    prepareSimpleLink(link);
    try {
      await navigator.clipboard.writeText(simpleUrlFor(link));
      setNotice(`Ссылка для ${link.fullName} скопирована. Сохранять её дополнительно не нужно.`);
    } catch {
      setOperationError('Браузер не разрешил автоматическое копирование. Нажмите кнопку открытия и скопируйте адрес из строки браузера.');
    }
  }

  function openSimpleLink(link: SimpleGroupLink) {
    window.open(simpleUrlFor(link), '_blank', 'noopener,noreferrer');
    prepareSimpleLink(link);
  }

  async function createSimpleLink(event: FormEvent) {
    event.preventDefault();
    const fullName = simpleName.trim().replace(/\s+/g, ' ');
    const group = groupMap.get(simpleGroupId);
    if (!fullName || !group) return;
    const key = `${group.id}:${normalizeName(fullName)}`;
    const existing = simpleLinks.find(link => link.id === key);
    const rosterStudent = lessons
      .filter(lesson => lesson.groupId === group.id)
      .flatMap(lesson => lesson.studentRoster ?? [])
      .find(student => normalizeName(student.fullName) === normalizeName(fullName));
    const knownStudent = students.find(student => student.active !== false && normalizeName(student.fullName) === normalizeName(fullName));
    const link = existing ?? {
      id: key,
      fullName,
      studentId: rosterStudent?.id ?? knownStudent?.id,
      groupId: group.id,
      groupName: group.name,
    };
    setOperationError('');
    saveManualSimpleLink(link);
    await copySimpleLink(link);
    setSimpleName('');
    setSimpleGroupId('');
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !groupIds.length) return;
    setBusy(true);
    setOperationError('');
    try {
      await onCreateStudent(name, groupIds);
      setNotice(`Ученик ${name.trim()} добавлен. Ссылка появится в готовом списке автоматически.`);
      setName('');
      setGroupIds([]);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyLegacy(token: string) {
    await navigator.clipboard.writeText(urlFor(token));
    setNotice('Старая персональная ссылка скопирована');
    window.setTimeout(() => setNotice(''), 2200);
  }

  async function repair(item: ParentAccess) {
    setBusy(true);
    setOperationError('');
    try {
      await onPrepare(item);
      setNotice('Старая персональная ссылка восстановлена');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    setOperationError('');
    try {
      await onRename(student, fullName);
      setNotice(`Имя изменено на «${fullName.trim().replace(/\s+/g, ' ')}». Адрес старой персональной ссылки сохранён.`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="dialog parent-access-dialog">
      <header><div><p className="eyebrow">РОДИТЕЛЬСКИЙ ДОСТУП</p><h2>Ученики и ссылки на расписание</h2></div><button onClick={onClose}><X /></button></header>
      <div className="dialog-note">Новые дети из занятий появляются ниже автоматически. Ничего создавать и сохранять не нужно: найдите ребёнка и нажмите «скопировать» или «открыть».</div>

      <section className="simple-group-link-form">
        <div><h3>Готовые ссылки на расписание групп</h3><p>Ссылка сразу открывает текущий календарь группы. При нажатии на занятие родитель увидит дату, время, кабинет, преподавателя, домашнее задание и комментарий.</p></div>
        <label className="parent-link-search simple-link-search"><Search size={17} /><input type="search" value={simpleSearch} onChange={event => setSimpleSearch(event.target.value)} placeholder="Найти ребёнка или группу" />{simpleSearch && <button type="button" onClick={() => setSimpleSearch('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>
        <div className="simple-group-links">
          {filteredSimpleLinks.map(link => <article key={link.id}><div><strong>{link.fullName}</strong><small>{link.groupName} · ссылка готова</small></div><button type="button" title="Скопировать" onClick={() => copySimpleLink(link)}><Copy size={16} /></button><button type="button" title="Открыть" onClick={() => openSimpleLink(link)}><ExternalLink size={16} /></button></article>)}
          {!filteredSimpleLinks.length && <p className="journal-empty">{simpleSearch ? 'Ребёнок с таким именем пока не найден в групповых занятиях.' : 'Добавьте ребёнка в список группового занятия — ссылка появится здесь автоматически.'}</p>}
        </div>
        <details className="manual-simple-link"><summary>Если ребёнка ещё нет в готовом списке</summary><form onSubmit={createSimpleLink}><label>Фамилия и имя<input list="simple-parent-students" value={simpleName} onChange={event => setSimpleName(event.target.value)} placeholder="Романенко Юлия" /></label><datalist id="simple-parent-students">{students.filter(student => student.active !== false).map(student => <option value={student.fullName} key={student.id} />)}</datalist><label>Группа<select value={simpleGroupId} onChange={event => setSimpleGroupId(event.target.value)}><option value="">Выберите группу</option>{Array.from(groupMap.values()).map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><button className="primary-button" disabled={!simpleName.trim() || !simpleGroupId}><Link2 size={16} />Добавить в список и скопировать</button></form></details>
      </section>

      {operationError && <div className="form-error" role="alert">{operationError}</div>}
      {notice && <div className="success-note">{notice}</div>}

      <details className="manual-parent-tools"><summary>Добавить ученика вручную (необязательно)</summary><form className="student-create-form" onSubmit={addStudent}><h3>Добавить ученика</h3><label>Фамилия и имя<input value={name} onChange={event => setName(event.target.value)} placeholder="Например: Мария Петрова" /></label><fieldset><legend>Прикрепить к группам</legend>{groups.map(group => <label key={group.id}><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => setGroupIds(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} />{group.name}</label>)}</fieldset><button className="ghost-button" disabled={busy || !name.trim() || !groupIds.length}><Plus size={16} />Добавить ученика</button></form></details>

      {access.some(item => item.active) && <details className="manual-parent-tools legacy-parent-tools"><summary>Старые персональные ссылки (для уже выданных адресов)</summary><section className="parent-links"><p className="legacy-parent-note">Старые рабочие ссылки продолжают действовать. Для новых детей используйте готовые групповые ссылки выше.</p><label className="parent-link-search"><Search size={17} /><input type="search" value={linkSearch} onChange={event => setLinkSearch(event.target.value)} placeholder="Найти старую ссылку" />{linkSearch && <button type="button" onClick={() => setLinkSearch('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>{filteredAccess.map(item => <article key={item.id}><div><strong>{item.studentIds.map(id => studentMap.get(id)?.fullName).filter(Boolean).join(' · ') || 'Ученик не найден'}</strong><small>Старая персональная ссылка</small></div><button title="Исправить фамилию или имя" disabled={busy} onClick={() => rename(item)}><Pencil size={16} /></button><button title="Скопировать" disabled={busy} onClick={() => copyLegacy(item.token)}><Copy size={16} /></button><button title="Открыть" disabled={busy} onClick={() => window.open(urlFor(item.token), '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></button><button title="Восстановить" disabled={busy} onClick={() => repair(item)}><RefreshCw size={16} /></button><button className="link-danger" title="Отключить" disabled={busy} onClick={() => onDisable(item)}><Unlink size={16} /></button></article>)}{!filteredAccess.length && <p className="journal-empty">Старая ссылка не найдена.</p>}<button className="ghost-button legacy-rebuild" disabled={busy || syncing} onClick={async () => { setBusy(true); setOperationError(''); try { await onRebuild(); setNotice('Старые персональные ссылки обновлены'); } catch (error) { setOperationError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }}><RefreshCw size={16} />{syncing ? 'Обновляем…' : 'Восстановить старые ссылки'}</button>{syncError && <div className="form-error" role="alert">Не удалось обновить старые ссылки: {syncError}</div>}</section></details>}

      <footer><span className="footer-spacer" /><button className="primary-button" onClick={onClose}>Готово</button></footer>
    </section>
  </div>;
}
