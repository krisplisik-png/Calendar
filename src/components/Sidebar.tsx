import { CalendarDays, LogOut, Plus, Users } from 'lucide-react';
import type { Group, UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  groups: Group[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAddGroup: () => void;
  onLogout: () => void;
}

export function Sidebar({ profile, groups, selected, onToggle, onAddGroup, onLogout }: Props) {
  const displayName = profile.name?.trim() || profile.email || 'Администратор';
  return <aside className="sidebar">
    <div className="brand"><CalendarDays size={24} /><span>Мой календарь</span></div>
    <nav><div className="nav-active"><CalendarDays size={18} />Расписание</div></nav>
    <div className="sidebar-section">
      <div className="section-title"><span><Users size={16} />Группы</span><button onClick={onAddGroup} aria-label="Добавить группу"><Plus size={17} /></button></div>
      <div className="group-list">
        {groups.map(group => <label className="group-filter" key={group.id}>
          <input type="checkbox" checked={selected.size === 0 || selected.has(group.id)} onChange={() => onToggle(group.id)} />
          <span className="color-dot" style={{ background: group.color }} />
          <span>{group.name}</span>
        </label>)}
        {!groups.length && <p className="sidebar-empty">Добавьте первую группу</p>}
      </div>
    </div>
    <div className="profile-block">
      <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
      <div><strong>{displayName}</strong><small>{profile.role} · {profile.schoolId}</small></div>
      <button onClick={onLogout} aria-label="Выйти"><LogOut size={18} /></button>
    </div>
  </aside>;
}
