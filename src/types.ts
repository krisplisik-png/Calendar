import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'parent';
export type GroupKind = 'group' | 'pair' | 'individual';

export interface UserProfile {
  name: string;
  email: string;
  role: UserRole;
  schoolId: string;
}

export interface Group {
  id: string;
  schoolId: string;
  teacherId?: string;
  name: string;
  kind?: GroupKind;
  color: string;
  course?: string;
  level?: string;
  studentIds: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Lesson {
  id: string;
  schoolId: string;
  groupId: string;
  teacherId?: string;
  date: string;
  startTime: string;
  endTime: string;
  course?: string;
  unit?: string;
  lesson?: string;
  topic?: string;
  homework?: string;
  notes?: string;
  recurrenceWeekdays?: number[];
  recurrenceUntil?: string;
  excludedDates?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
