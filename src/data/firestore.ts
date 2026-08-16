import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where, type DocumentData, type FirestoreError,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Group, Lesson } from '../types';

type Unsubscribe = () => void;
type ErrorHandler = (error: FirestoreError) => void;

function mapDocument<T extends { id: string }>(data: DocumentData, id: string): T {
  return { id, ...data } as T;
}

export function subscribeToGroups(schoolId: string, next: (items: Group[]) => void, error: ErrorHandler): Unsubscribe {
  const groupsQuery = query(collection(db, 'groups'), where('schoolId', '==', schoolId));
  return onSnapshot(groupsQuery, snapshot => {
    next(snapshot.docs.map(item => mapDocument<Group>(item.data(), item.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  }, error);
}

export function subscribeToLessons(schoolId: string, next: (items: Lesson[]) => void, error: ErrorHandler): Unsubscribe {
  const lessonsQuery = query(collection(db, 'lessons'), where('schoolId', '==', schoolId));
  return onSnapshot(lessonsQuery, snapshot => {
    next(snapshot.docs.map(item => mapDocument<Lesson>(item.data(), item.id)).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)));
  }, error);
}

export async function createGroup(schoolId: string, input: Pick<Group, 'name' | 'color' | 'course' | 'level' | 'notes'>) {
  return addDoc(collection(db, 'groups'), {
    ...input, schoolId, studentIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function createLesson(schoolId: string, input: Omit<Lesson, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, 'lessons'), {
    ...input, schoolId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function updateLesson(id: string, input: Partial<Omit<Lesson, 'id' | 'schoolId' | 'createdAt'>>) {
  return updateDoc(doc(db, 'lessons', id), { ...input, updatedAt: serverTimestamp() });
}

export async function removeLesson(id: string) {
  return deleteDoc(doc(db, 'lessons', id));
}
