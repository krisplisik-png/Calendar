import {
  addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, query, serverTimestamp, setDoc,
  updateDoc, where, type DocumentData, type FirestoreError,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Group, Lesson, Payment, SchoolUser } from '../types';

type Unsubscribe = () => void;
type ErrorHandler = (error: FirestoreError) => void;

function mapDocument<T extends { id: string }>(data: DocumentData, id: string): T {
  return { id, ...data } as T;
}

export function subscribeToGroups(schoolId: string, next: (items: Group[]) => void, error: ErrorHandler, teacherId?: string): Unsubscribe {
  const groupsQuery = teacherId
    ? query(collection(db, 'groups'), where('schoolId', '==', schoolId), where('teacherId', '==', teacherId))
    : query(collection(db, 'groups'), where('schoolId', '==', schoolId));
  return onSnapshot(groupsQuery, snapshot => {
    next(snapshot.docs.map(item => mapDocument<Group>(item.data(), item.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  }, error);
}

export function subscribeToLessons(schoolId: string, next: (items: Lesson[]) => void, error: ErrorHandler, teacherId?: string): Unsubscribe {
  const lessonsQuery = teacherId
    ? query(collection(db, 'lessons'), where('schoolId', '==', schoolId), where('teacherId', '==', teacherId))
    : query(collection(db, 'lessons'), where('schoolId', '==', schoolId));
  return onSnapshot(lessonsQuery, snapshot => {
    next(snapshot.docs.map(item => mapDocument<Lesson>(item.data(), item.id)).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
  }, error);
}

export async function createGroup(schoolId: string, input: Pick<Group, 'name' | 'kind' | 'color' | 'course' | 'level' | 'notes' | 'monthlyLessonTarget' | 'subscriptionLessonPrice' | 'singleLessonPrice'>) {
  return addDoc(collection(db, 'groups'), {
    ...input, schoolId, studentIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function updateGroup(id: string, input: Partial<Omit<Group, 'id' | 'schoolId' | 'createdAt'>>) {
  return updateDoc(doc(db, 'groups', id), { ...input, updatedAt: serverTimestamp() });
}

export async function setGroupTeacher(id: string, teacherId: string) {
  return updateDoc(doc(db, 'groups', id), { teacherId: teacherId || deleteField(), updatedAt: serverTimestamp() });
}

export async function removeGroup(id: string) {
  return deleteDoc(doc(db, 'groups', id));
}

export async function createLesson(schoolId: string, input: Omit<Lesson, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, 'lessons'), {
    ...input, schoolId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function updateLesson(id: string, input: Partial<Omit<Lesson, 'id' | 'schoolId' | 'createdAt'>>) {
  return updateDoc(doc(db, 'lessons', id), { ...input, updatedAt: serverTimestamp() });
}

export async function setLessonTeacher(id: string, teacherId: string) {
  return updateDoc(doc(db, 'lessons', id), { teacherId: teacherId || deleteField(), updatedAt: serverTimestamp() });
}

export async function removeLesson(id: string) {
  return deleteDoc(doc(db, 'lessons', id));
}

export function subscribeToPayments(schoolId: string, month: string, next: (items: Payment[]) => void, error: ErrorHandler): Unsubscribe {
  const paymentsQuery = query(collection(db, 'payments'), where('schoolId', '==', schoolId), where('month', '==', month));
  return onSnapshot(paymentsQuery, snapshot => next(snapshot.docs.map(item => mapDocument<Payment>(item.data(), item.id))), error);
}

export async function savePayment(payment: Omit<Payment, 'createdAt' | 'updatedAt'>) {
  return setDoc(doc(db, 'payments', payment.id), { ...payment, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToTeachers(schoolId: string, next: (items: SchoolUser[]) => void, error: ErrorHandler): Unsubscribe {
  const teachersQuery = query(collection(db, 'users'), where('schoolId', '==', schoolId), where('role', '==', 'teacher'));
  return onSnapshot(teachersQuery, snapshot => next(snapshot.docs.map(item => mapDocument<SchoolUser>(item.data(), item.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))), error);
}
