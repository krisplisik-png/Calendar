import type { Group } from '../types';

export function pairStudentNames(group?: Pick<Group, 'id' | 'name' | 'kind' | 'studentNames'> | null): string[] {
  if (!group || (group.kind ?? 'group') !== 'pair') return [];
  const savedNames = (group.studentNames ?? []).map(name => name.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 2);
  if (savedNames.length === 2) return savedNames;

  const separatedNames = group.name.split(/\s+(?:и|&)\s+|[,;/]+/iu).map(name => name.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (separatedNames.length === 2) return separatedNames;

  // Older pairs were saved in one field. The usual "Фамилия Имя Фамилия Имя"
  // form can still be migrated without asking the user to recreate the pair.
  const words = group.name.trim().split(/\s+/).filter(Boolean);
  return words.length === 4 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : savedNames;
}
