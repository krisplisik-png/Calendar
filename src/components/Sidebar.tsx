import { useState } from 'react';
import { CalendarDays, CreditCard, GraduationCap, LogOut, Plus, Trash2, Users } from 'lucide-react';
import type { Group, UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  groups: Group[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAddGroup: () => void;
  onDeleteGroup: (group: Group) => Promise<void>;
  activeView: 'calendar' | 'payments';
  onNavigate: (view: 'calendar' | 'payments') => void;
  canManage: boolean;
  onManageTeachers: () => void;
  onLogout: () => void;
}

export function Sidebar({ profile, groups, selected, onToggle, onAddGroup, onDeleteGroup, activeView, onNavigate, canManage, onManageTeachers, onLogout }: Props) {
  const displayName = profile.name?.trim() || profile.email || 'Администратор';
  const [pendingDelete, setPendingDelete] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);
  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDeleteGroup(pendingDelete);
      setPendingDelete(null);
    } catch {
      // The parent shows the human-readable Firestore error.
    } finally {
      setDeleting(false);
    }
  }
  return <aside className="sidebar">
    <div className="brand"><CalendarDays size={24} /><span>Мой календарь</span></div>
    <nav className="sidebar-nav"><button className={activeView === 'calendar' ? 'nav-active' : ''} onClick={() => onNavigate('calendar')}><CalendarDays size={18} />Расписание</button>{canManage && <button className={activeView === 'payments' ? 'nav-active' : ''} onClick={() => onNavigate('payments')}><CreditCard size={18} />Оплаты</button>}{canManage && <button onClick={onManageTeachers}><GraduationCap size={18} />Учителя</button>}</nav>
    <div className="sidebar-section">
      <div className="section-title"><span><Users size={16} />Ученики и группы</span>{canManage && <button onClick={onAddGroup} aria-label="Добавить ученика или группу"><Plus size={17} /></button>}</div>
      <div className="group-list">
        {groups.map(group => <div className="group-filter" key={group.id}>
          <input type="checkbox" checked={selected.size === 0 || selected.has(group.id)} onChange={() => onToggle(group.id)} />
          <span className="color-dot" style={{ background: group.color }} />
          <button className="participant-name" onClick={() => canManage && setPendingDelete(group)} title={canManage ? 'Удалить запись' : undefined}><span>{group.name}<small className="kind-label">{(group.kind ?? 'group') === 'group' ? 'группа' : group.kind === 'pair' ? 'пара' : 'индивидуально'}</small></span>{canManage && <Trash2 size={14} />}</button>
        </div>)}
        {!groups.length && <p className="sidebar-empty">Добавьте ученика или группу</p>}
      </div>
      {pendingDelete && <div className="sidebar-delete-confirm" role="alertdialog" aria-label="Подтверждение удаления">
        <strong>Удалить «{pendingDelete.name}»?</strong>
        <small>Связанные занятия останутся в календаре.</small>
        <div><button onClick={() => setPendingDelete(null)} disabled={deleting}>Отмена</button><button className="confirm-delete-button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Удаляем…' : 'Удалить'}</button></div>
      </div>}
    </div>
    <div className="profile-block">
      <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
      <div><strong>{displayName}</strong><small>{profile.role} · {profile.schoolId}</small></div>
      <button onClick={onLogout} aria-label="Выйти"><LogOut size={18} /></button>
    </div>
  </aside>;
}
