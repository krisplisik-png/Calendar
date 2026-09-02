import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { Group, Lesson, ParentAccess, SchoolUser, Student } from '../types';

const kindLabels = { group: 'Группа', pair: 'Пара', individual: 'Индивидуал' } as const;
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function GroupsExportDialog({ groups, lessons, students, access, teachers, syncing, onClose }: {
  groups: Group[]; lessons: Lesson[]; students: Student[]; access: ParentAccess[]; teachers: SchoolUser[]; syncing?: boolean; onClose: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(groups.map(group => group.id)));
  const [includeLinks, setIncludeLinks] = useState(true);
  const teacherMap = useMemo(() => new Map(teachers.map(teacher => [teacher.id, teacher.name || teacher.email])), [teachers]);
  const accessMap = useMemo(() => {
    const result = new Map<string, ParentAccess>();
    access.filter(item => item.active).forEach(item => item.studentIds.forEach(studentId => { if (!result.has(studentId)) result.set(studentId, item); }));
    return result;
  }, [access]);
  const urlFor = (token: string) => `${window.location.origin}${window.location.pathname}?parent=${encodeURIComponent(token)}`;
  function toggle(id: string) { setSelected(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function exportFile() {
    const headers = ['Группа', 'Формат', 'Курс', 'Уровень', 'Учитель', 'ФИ ребёнка', ...(includeLinks ? ['Родительская ссылка'] : [])];
    const rows: string[][] = [];
    groups.filter(group => selected.has(group.id)).forEach(group => {
      const normalized = students.filter(student => student.active !== false && student.groupIds.includes(group.id));
      const rosterNames = Array.from(new Set(lessons.filter(lesson => lesson.groupId === group.id).flatMap(lesson => lesson.studentRoster ?? []).map(item => item.fullName.trim()).filter(Boolean)));
      const children = normalized.length ? normalized.map(student => ({ id: student.id, name: student.fullName })) : rosterNames.length ? rosterNames.map(name => ({ id: '', name })) : [{ id: '', name: (group.kind ?? 'group') === 'individual' ? group.name : '' }];
      children.forEach(child => {
        const link = child.id ? accessMap.get(child.id) : undefined;
        rows.push([group.name, kindLabels[group.kind ?? 'group'], group.course ?? '', group.level ?? '', group.teacherId ? teacherMap.get(group.teacherId) ?? '' : '', child.name, ...(includeLinks ? [link ? urlFor(link.token) : ''] : [])]);
      });
    });
    const csv = `\uFEFFsep=;\r\n${[headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}`;
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = href; anchor.download = `groups-${new Date().toISOString().slice(0, 10)}${includeLinks ? '-with-parent-links' : ''}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(href);
  }
  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog export-dialog"><header><div><p className="eyebrow">ЭКСПОРТ В EXCEL</p><h2>Группы и ученики</h2></div><button onClick={onClose}><X /></button></header><p className="dialog-note">Выберите группы. Файл CSV корректно открывается в Microsoft Excel, каждая запись ребёнка будет отдельной строкой.</p>
    <div className="export-actions"><button className="ghost-button" onClick={() => setSelected(new Set(groups.map(group => group.id)))}>Выбрать все</button><button className="ghost-button" onClick={() => setSelected(new Set())}>Снять выбор</button></div>
    <div className="export-group-list">{groups.map(group => <label key={group.id}><input type="checkbox" checked={selected.has(group.id)} onChange={() => toggle(group.id)} /><span className="color-dot" style={{ background: group.color }} /><span><strong>{group.name}</strong><small>{kindLabels[group.kind ?? 'group']}</small></span></label>)}</div>
    <label className="export-link-option"><input type="checkbox" checked={includeLinks} onChange={event => setIncludeLinks(event.target.checked)} /><span><strong>Добавить родительские ссылки</strong><small>Если выключить, файл будет содержать только информацию о группах и детях.</small></span></label>
    {syncing && <div className="dialog-note">Обновляем списки детей и родительские ссылки…</div>}
    <footer><button className="ghost-button" onClick={onClose}>Отмена</button><span className="footer-spacer" /><button className="primary-button" disabled={!selected.size || syncing} onClick={exportFile}><Download size={17} />{syncing ? 'Подождите…' : 'Скачать для Excel'}</button></footer></section></div>;
}
