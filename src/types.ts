import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'admin' | 'teacher' | 'parent';
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
  monthlyLessonTarget?: 6 | 7 | 8 | 9 | 10;
  subscriptionLessonPrice?: number;
  singleLessonPrice?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Payment {
  id: string;
  schoolId: string;
  participantId: string;
  participantNameSnapshot: string;
  participantKind: GroupKind;
  month: string;
  periodStart: string;
  periodEnd: string;
  plannedLessons: number;
  scheduledLessons: number;
  completedLessons: number;
  amountDue: number;
  amountPaid: number;
  currency: 'RUB';
  status: PaymentStatus;
  paymentMethod?: 'cash' | 'transfer' | 'other';
  notes?: string;
  subscriptionLessons?: number;
  singleLessons?: number;
  subscriptionLessonPrice?: number;
  singleLessonPrice?: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudentRosterItem {
  id: string;
  fullName: string;
}

export interface StudentLessonStatus {
  attended: boolean;
  homeworkDone: boolean;
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
  billingType?: 'subscription' | 'single';
  recurrenceWeekdays?: number[];
  recurrenceUntil?: string;
  excludedDates?: string[];
  studentRoster?: StudentRosterItem[];
  studentStatusByDate?: Record<string, Record<string, StudentLessonStatus>>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
