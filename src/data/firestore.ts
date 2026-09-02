import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch, type DocumentData, type FirestoreError,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Group, Lesson, ParentAccess, ParentMonthView, ParentView, Payment, SchoolUser, Student } from '../types';
import { buildParentLessons, generateParentToken, parentMonthKeys } from '../domain/parentViews';

type Unsubscribe = () => void;
type ErrorHandler = (error: FirestoreError) => void;

function mapDocument<T extends { id: string }>(data: DocumentData, id: string): T {
  return { id, ...data } as T;
}

export function subscribeToGroups(schoolId: string, next: (items: Group[]) => void, error: ErrorHandler, teacherId?: string): Unsubscribe {
  if (!teacherId) {
    const groupsQuery = query(collection(db, 'groups'), where('schoolId', '==', schoolId));
    return onSnapshot(groupsQuery, snapshot => next(snapshot.docs.map(item => mapDocument<Group>(item.data(), item.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))), error);
  }
  const primary = new Map<string, Group>();
  const substitute = new Map<string, Group>();
  const emit = () => next(Array.from(new Map([...primary, ...substitute]).values()).sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  const offPrimary = onSnapshot(query(collection(db, 'groups'), where('schoolId', '==', schoolId), where('teacherId', '==', teacherId)), snapshot => { primary.clear(); snapshot.docs.forEach(item => primary.set(item.id, mapDocument<Group>(item.data(), item.id))); emit(); }, error);
  const offSubstitute = onSnapshot(query(collection(db, 'groups'), where('schoolId', '==', schoolId), where('authorizedTeacherIds', 'array-contains', teacherId)), snapshot => { substitute.clear(); snapshot.docs.forEach(item => substitute.set(item.id, mapDocument<Group>(item.data(), item.id))); emit(); }, error);
  return () => { offPrimary(); offSubstitute(); };
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

export async function publishPublicLesson(id: string, schoolId: string, lesson: Partial<Lesson>, group?: Group) {
  if (group?.kind !== 'group' || !lesson.minAge || !lesson.maxAge) {
    return deleteDoc(doc(db, 'publicLessons', id));
  }
  return setDoc(doc(db, 'publicLessons', id), {
    schoolId, groupId: group.id, groupName: group.name,
    minAge: lesson.minAge, maxAge: lesson.maxAge,
    date: lesson.date, startTime: lesson.startTime, endTime: lesson.endTime,
    course: lesson.course ?? '', recurrenceWeekdays: lesson.recurrenceWeekdays ?? [],
    recurrenceUntil: lesson.recurrenceUntil ?? '', excludedDates: lesson.excludedDates ?? [],
    updatedAt: serverTimestamp(),
  });
}

export async function removePublicLesson(id: string) {
  return deleteDoc(doc(db, 'publicLessons', id));
}

export async function savePublicLessonComment(schoolId: string, lessonId: string, occurrenceDate: string, commentKey: string, comment: string) {
  const reference = doc(db, 'publicLessonComments', `${lessonId}__${occurrenceDate}__${commentKey}`);
  return setDoc(reference, { schoolId, lessonId, occurrenceDate, commentKey, comment: comment.trim(), updatedAt: serverTimestamp() });
}

export async function getPublicLessonComment(lessonId: string, occurrenceDate: string, commentKey: string) {
  const snapshot = await getDoc(doc(db, 'publicLessonComments', `${lessonId}__${occurrenceDate}__${commentKey}`));
  return snapshot.exists() ? String(snapshot.data().comment ?? '') : '';
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

export function subscribeToStudents(schoolId: string, next: (items: Student[]) => void, error: ErrorHandler): Unsubscribe {
  const studentsQuery = query(collection(db, 'students'), where('schoolId', '==', schoolId));
  return onSnapshot(studentsQuery, snapshot => next(snapshot.docs.map(item => mapDocument<Student>(item.data(), item.id)).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))), error);
}

export async function createStudent(schoolId: string, fullName: string, groupIds: string[]) {
  const reference = await addDoc(collection(db, 'students'), { schoolId, fullName: fullName.trim(), groupIds, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await Promise.all(groupIds.map(async groupId => {
    const group = await getDoc(doc(db, 'groups', groupId));
    if (group.exists()) await updateGroup(groupId, { studentIds: Array.from(new Set([...(group.data().studentIds ?? []), reference.id])) });
  }));
  return reference;
}

export function subscribeToParentAccess(schoolId: string, next: (items: ParentAccess[]) => void, error: ErrorHandler): Unsubscribe {
  const accessQuery = query(collection(db, 'parentAccess'), where('schoolId', '==', schoolId));
  return onSnapshot(accessQuery, snapshot => next(snapshot.docs.map(item => mapDocument<ParentAccess>(item.data(), item.id))), error);
}

async function schoolData(schoolId: string) {
  const scoped = (name: string) => getDocs(query(collection(db, name), where('schoolId', '==', schoolId)));
  const [studentDocs, groupDocs, lessonDocs, userDocs, accessDocs] = await Promise.all([scoped('students'), scoped('groups'), scoped('lessons'), scoped('users'), scoped('parentAccess')]);
  return {
    students: studentDocs.docs.map(item => mapDocument<Student>(item.data(), item.id)),
    groups: groupDocs.docs.map(item => mapDocument<Group>(item.data(), item.id)),
    lessons: lessonDocs.docs.map(item => mapDocument<Lesson>(item.data(), item.id)),
    teachers: userDocs.docs.map(item => mapDocument<SchoolUser>(item.data(), item.id)),
    accesses: accessDocs.docs.map(item => mapDocument<ParentAccess>(item.data(), item.id)),
  };
}

export async function rebuildParentViewsForSchool(schoolId: string) {
  const data = await schoolData(schoolId);
  const months = parentMonthKeys();
  for (const access of data.accesses.filter(item => item.active)) {
    const selected = data.students.filter(student => access.studentIds.includes(student.id) && student.active !== false);
    const lessonsByMonth = buildParentLessons(access.studentIds, data.students, data.groups, data.lessons, data.teachers, months);
    const batch = writeBatch(db);
    batch.set(doc(db, 'parentViews', access.token), { schoolId, active: true, students: selected.map(student => ({ id: student.id, fullName: student.fullName })), availableMonths: months, updatedAt: serverTimestamp() }, { merge: true });
    months.forEach(month => batch.set(doc(db, 'parentViews', access.token, 'months', month), { month, lessons: lessonsByMonth[month], updatedAt: serverTimestamp() }));
    await batch.commit();
  }
}

export async function createParentLink(schoolId: string, studentIds: string[]) {
  const token = generateParentToken();
  await addDoc(collection(db, 'parentAccess'), { schoolId, token, studentIds, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await rebuildParentViewsForSchool(schoolId);
  return token;
}

export async function syncParentLinksFromSchedule(schoolId: string) {
  const data = await schoolData(schoolId);
  const students = [...data.students];
  const byName = new Map(students.map(student => [student.fullName.trim().toLocaleLowerCase('ru'), student]));
  let studentsCreated = 0;
  let linksCreated = 0;

  for (const group of data.groups) {
    const names = new Set<string>();
    const groupStudentIds = new Set(group.studentIds ?? []);
    if ((group.kind ?? 'group') === 'individual' && group.name.trim()) names.add(group.name.trim());
    data.lessons.filter(lesson => lesson.groupId === group.id).forEach(lesson => lesson.studentRoster?.forEach(student => {
      if (student.fullName.trim()) names.add(student.fullName.trim());
    }));
    for (const fullName of names) {
      const key = fullName.toLocaleLowerCase('ru');
      let student = byName.get(key);
      if (!student) {
        const reference = await addDoc(collection(db, 'students'), { schoolId, fullName, groupIds: [group.id], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        student = { id: reference.id, schoolId, fullName, groupIds: [group.id], active: true } as Student;
        students.push(student); byName.set(key, student); studentsCreated += 1;
      } else if (!student.groupIds.includes(group.id)) {
        student = { ...student, groupIds: [...student.groupIds, group.id] };
        byName.set(key, student);
        const index = students.findIndex(item => item.id === student!.id);
        students[index] = student;
        await updateDoc(doc(db, 'students', student.id), { groupIds: student.groupIds, updatedAt: serverTimestamp() });
      }
      groupStudentIds.add(student.id);
    }
    if (groupStudentIds.size !== (group.studentIds ?? []).length) await updateGroup(group.id, { studentIds: Array.from(groupStudentIds) });
  }

  for (const student of students) {
    if (data.accesses.some(access => access.studentIds.includes(student.id))) continue;
    await addDoc(collection(db, 'parentAccess'), { schoolId, token: generateParentToken(), studentIds: [student.id], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    linksCreated += 1;
  }
  await rebuildParentViewsForSchool(schoolId);
  return { studentsCreated, linksCreated };
}

export async function regenerateParentLink(access: ParentAccess) {
  const token = generateParentToken();
  const batch = writeBatch(db);
  batch.update(doc(db, 'parentAccess', access.id), { token, active: true, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'parentViews', access.token), { active: false, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  await rebuildParentViewsForSchool(access.schoolId);
  return token;
}

export async function disableParentLink(access: ParentAccess) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'parentAccess', access.id), { active: false, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'parentViews', access.token), { active: false, updatedAt: serverTimestamp() }, { merge: true });
  return batch.commit();
}

export async function getParentView(token: string): Promise<ParentView | null> {
  const snapshot = await getDoc(doc(db, 'parentViews', token));
  return snapshot.exists() ? mapDocument<ParentView>(snapshot.data(), snapshot.id) : null;
}

export async function getParentMonth(token: string, month: string): Promise<ParentMonthView | null> {
  const snapshot = await getDoc(doc(db, 'parentViews', token, 'months', month));
  return snapshot.exists() ? mapDocument<ParentMonthView>(snapshot.data(), snapshot.id) : null;
}
