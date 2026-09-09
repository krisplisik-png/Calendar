import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch, type DocumentData, type FirestoreError,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DateTime } from 'luxon';
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

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

export async function createLesson(schoolId: string, input: Omit<Lesson, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, 'lessons'), {
    ...withoutUndefined(input), schoolId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function updateLesson(id: string, input: Partial<Omit<Lesson, 'id' | 'schoolId' | 'createdAt'>>) {
  return updateDoc(doc(db, 'lessons', id), { ...withoutUndefined(input), updatedAt: serverTimestamp() });
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

export async function savePublicLessonComment(schoolId: string, lessonId: string, occurrenceDate: string, commentKey: string, comment: string, homeworkDone?: boolean, homeworkAssigned?: boolean) {
  const reference = doc(db, 'publicLessonComments', `${lessonId}__${occurrenceDate}__${commentKey}`);
  return setDoc(reference, { schoolId, lessonId, occurrenceDate, commentKey, comment: comment.trim(), ...(homeworkDone === undefined ? {} : { homeworkDone }), ...(homeworkAssigned === undefined ? {} : { homeworkAssigned }), updatedAt: serverTimestamp() }, { merge: true });
}

export async function getPublicLessonComment(lessonId: string, occurrenceDate: string, commentKey: string) {
  return (await getPublicLessonFeedback(lessonId, occurrenceDate, commentKey)).comment;
}

export async function getPublicLessonFeedback(lessonId: string, occurrenceDate: string, commentKey: string): Promise<{ comment: string; homeworkDone?: boolean; homeworkAssigned?: boolean }> {
  const snapshot = await getDoc(doc(db, 'publicLessonComments', `${lessonId}__${occurrenceDate}__${commentKey}`));
  if (!snapshot.exists()) return { comment: '' };
  const data = snapshot.data();
  return { comment: String(data.comment ?? ''), ...(typeof data.homeworkDone === 'boolean' ? { homeworkDone: data.homeworkDone } : {}), ...(typeof data.homeworkAssigned === 'boolean' ? { homeworkAssigned: data.homeworkAssigned } : {}) };
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

export async function attachStudentToGroups(student: Student, groupIds: string[]) {
  const mergedGroupIds = Array.from(new Set([...student.groupIds, ...groupIds]));
  await updateDoc(doc(db, 'students', student.id), { groupIds: mergedGroupIds, active: true, updatedAt: serverTimestamp() });
  await Promise.all(groupIds.map(async groupId => {
    const group = await getDoc(doc(db, 'groups', groupId));
    if (group.exists()) await updateGroup(groupId, { studentIds: Array.from(new Set([...(group.data().studentIds ?? []), student.id])) });
  }));
}

export async function updateScheduledStudentName(schoolId: string, groupId: string, rosterId: string, previousName: string, fullName: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const cleanName = fullName.trim().replace(/\s+/g, ' ');
  const snapshot = await getDocs(query(collection(db, 'students'), where('schoolId', '==', schoolId)));
  const directMatches = snapshot.docs.filter(item => {
    const student = item.data() as Student;
    return student.active !== false && (student.groupIds ?? []).includes(groupId)
      && (item.id === rosterId || normalize(student.fullName ?? '') === normalize(previousName));
  });
  const relatedGroupIds = new Set(directMatches.flatMap(item => ((item.data() as Student).groupIds ?? [])));
  const matches = snapshot.docs.filter(item => {
    const student = item.data() as Student;
    return student.active !== false && normalize(student.fullName ?? '') === normalize(previousName)
      && (directMatches.some(match => match.id === item.id) || (student.groupIds ?? []).some(id => relatedGroupIds.has(id)));
  });
  await Promise.all(matches.map(item => updateDoc(item.ref, { fullName: cleanName, updatedAt: serverTimestamp() })));
  const renamedIds = matches.map(item => item.id);
  if (renamedIds.length) {
    const refreshed = await schoolData(schoolId);
    const affectedAccesses = refreshed.accesses.filter(access => access.active && access.studentIds.some(id => renamedIds.includes(id)));
    if (affectedAccesses.length) await writeParentViews(schoolId, refreshed, affectedAccesses);
  }
  return renamedIds;
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

async function writeParentViews(schoolId: string, data: Awaited<ReturnType<typeof schoolData>>, accesses: ParentAccess[], months = parentMonthKeys()) {
  const activeAccesses = accesses.filter(item => item.active);
  const parallelLimit = 5;
  for (let offset = 0; offset < activeAccesses.length; offset += parallelLimit) {
    await Promise.all(activeAccesses.slice(offset, offset + parallelLimit).map(async access => {
      const selected = data.students.filter(student => access.studentIds.includes(student.id) && student.active !== false);
      const lessonsByMonth = buildParentLessons(access.studentIds, data.students, data.groups, data.lessons, data.teachers, months);
      // Create the public link first. A problem in one monthly document must
      // never roll back the link itself and make it look invalid.
      await setDoc(doc(db, 'parentViews', access.token), { schoolId, active: true, students: selected.map(student => ({ id: student.id, fullName: student.fullName })), availableMonths: months, updatedAt: serverTimestamp() }, { merge: true });
      const batch = writeBatch(db);
      months.forEach(month => batch.set(doc(db, 'parentViews', access.token, 'months', month), { month, lessons: lessonsByMonth[month], updatedAt: serverTimestamp() }));
      await batch.commit();
    }));
  }
}

async function writeParentViewRoots(schoolId: string, data: Awaited<ReturnType<typeof schoolData>>, accesses: ParentAccess[]) {
  const months = parentMonthKeys();
  const activeAccesses = accesses.filter(item => item.active);
  const parallelLimit = 10;
  for (let offset = 0; offset < activeAccesses.length; offset += parallelLimit) {
    await Promise.all(activeAccesses.slice(offset, offset + parallelLimit).map(access => {
      const selected = data.students.filter(student => access.studentIds.includes(student.id) && student.active !== false);
      return setDoc(doc(db, 'parentViews', access.token), {
        schoolId,
        active: true,
        students: selected.map(student => ({ id: student.id, fullName: student.fullName })),
        availableMonths: months,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }));
  }
}

export async function rebuildParentViewsForSchool(schoolId: string) {
  const data = await schoolData(schoolId);
  const activeAccesses = data.accesses.filter(access => access.active);
  // Every issued token must at least have a readable public root document.
  // Duplicate tokens are still valid links, even though only one is shown in the UI.
  await writeParentViewRoots(schoolId, data, activeAccesses);
  const seenStudents = new Set<string>();
  const uniqueAccesses = activeAccesses.filter(access => {
    const key = [...access.studentIds].sort().join('|');
    if (seenStudents.has(key)) return false;
    seenStudents.add(key);
    return true;
  });
  const currentMonth = DateTime.now().setZone('Asia/Yekaterinburg').startOf('month');
  const nearbyMonths = [-1, 0, 1].map(offset => currentMonth.plus({ months: offset }).toFormat('yyyy-MM'));
  await writeParentViews(schoolId, data, uniqueAccesses, nearbyMonths);
}

export async function rebuildParentView(access: ParentAccess) {
  const data = await schoolData(access.schoolId);
  await writeParentViews(access.schoolId, data, [{ ...access, active: true }]);
}

export async function createParentLink(schoolId: string, studentIds: string[]) {
  const token = generateParentToken();
  const reference = await addDoc(collection(db, 'parentAccess'), { schoolId, token, studentIds, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const data = await schoolData(schoolId);
  const access = { id: reference.id, schoolId, token, studentIds, active: true } as ParentAccess;
  await writeParentViews(schoolId, data, [access]);
  return token;
}

export async function ensureParentLinkForStudent(schoolId: string, fullName: string, groupIds: string[]) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const cleanName = fullName.trim().replace(/\s+/g, ' ');
  let data = await schoolData(schoolId);
  let matchingStudents = data.students.filter(item => item.active !== false && normalize(item.fullName) === normalize(cleanName));
  let student = matchingStudents.find(item => groupIds.some(groupId => item.groupIds.includes(groupId))) ?? matchingStudents[0];
  if (!student) {
    const reference = await createStudent(schoolId, cleanName, groupIds);
    student = { id: reference.id, schoolId, fullName: cleanName, groupIds, active: true } as Student;
    matchingStudents = [student];
  } else if (groupIds.some(groupId => !student!.groupIds.includes(groupId))) {
    await attachStudentToGroups(student, groupIds);
    student = { ...student, groupIds: Array.from(new Set([...student.groupIds, ...groupIds])) };
  }
  const matchingIds = new Set(matchingStudents.map(item => item.id));
  data = await schoolData(schoolId);
  let matchingAccesses = data.accesses.filter(item => item.active && item.studentIds.some(id => matchingIds.has(id)));
  if (!matchingAccesses.length) {
    const token = generateParentToken();
    const reference = await addDoc(collection(db, 'parentAccess'), { schoolId, token, studentIds: [student.id], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    matchingAccesses = [{ id: reference.id, schoolId, token, studentIds: [student.id], active: true } as ParentAccess];
  }
  await Promise.all(matchingAccesses.map(access => access.studentIds.length === 1 && access.studentIds[0] === student!.id
    ? Promise.resolve()
    : updateDoc(doc(db, 'parentAccess', access.id), { studentIds: [student!.id], updatedAt: serverTimestamp() })));
  data = await schoolData(schoolId);
  const normalizedAccesses = matchingAccesses.map(access => ({ ...access, studentIds: [student!.id] }));
  await writeParentViewRoots(schoolId, data, normalizedAccesses);
  return normalizedAccesses[0].token;
}

export async function syncParentLinksFromSchedule(schoolId: string) {
  const data = await schoolData(schoolId);
  const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const students = [...data.students].sort((a, b) => Number(b.active !== false) - Number(a.active !== false));
  const byName = new Map<string, Student>();
  const duplicateStudentIds = new Map<string, string>();
  for (const student of students) {
    const key = normalizeName(student.fullName);
    const canonical = byName.get(key);
    if (!canonical) {
      byName.set(key, student);
      continue;
    }
    duplicateStudentIds.set(student.id, canonical.id);
    const mergedGroupIds = Array.from(new Set([...canonical.groupIds, ...student.groupIds]));
    if (mergedGroupIds.length !== canonical.groupIds.length) {
      canonical.groupIds = mergedGroupIds;
      await updateDoc(doc(db, 'students', canonical.id), { groupIds: mergedGroupIds, updatedAt: serverTimestamp() });
    }
    if (student.active !== false) await updateDoc(doc(db, 'students', student.id), { active: false, updatedAt: serverTimestamp() });
  }

  const normalizedAccesses: ParentAccess[] = [];
  for (const access of data.accesses) {
    const studentIds = Array.from(new Set(access.studentIds.map(id => duplicateStudentIds.get(id) ?? id)));
    if (studentIds.some((id, index) => id !== access.studentIds[index]) || studentIds.length !== access.studentIds.length) {
      await updateDoc(doc(db, 'parentAccess', access.id), { studentIds, updatedAt: serverTimestamp() });
    }
    normalizedAccesses.push({ ...access, studentIds });
  }
  let studentsCreated = 0;
  let linksCreated = 0;

  for (const group of data.groups) {
    const names = new Set<string>();
    const groupStudentIds = new Set((group.studentIds ?? []).map(id => duplicateStudentIds.get(id) ?? id));
    if ((group.kind ?? 'group') === 'individual' && group.name.trim()) names.add(group.name.trim());
    data.lessons.filter(lesson => lesson.groupId === group.id).forEach(lesson => lesson.studentRoster?.forEach(student => {
      if (student.fullName.trim()) names.add(student.fullName.trim());
    }));
    for (const fullName of names) {
      const key = normalizeName(fullName);
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
    const normalizedGroupStudentIds = Array.from(groupStudentIds);
    if (normalizedGroupStudentIds.length !== (group.studentIds ?? []).length || normalizedGroupStudentIds.some(id => !(group.studentIds ?? []).includes(id))) await updateGroup(group.id, { studentIds: normalizedGroupStudentIds });
  }

  for (const student of students.filter(item => item.active !== false && !duplicateStudentIds.has(item.id))) {
    if (normalizedAccesses.some(access => access.active && access.studentIds.includes(student.id))) continue;
    const token = generateParentToken();
    const reference = await addDoc(collection(db, 'parentAccess'), { schoolId, token, studentIds: [student.id], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const createdAccess = { id: reference.id, schoolId, token, studentIds: [student.id], active: true } as ParentAccess;
    normalizedAccesses.push(createdAccess);
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
  if (!snapshot.exists()) return null;
  const view = mapDocument<ParentView>(snapshot.data(), snapshot.id);
  return {
    ...view,
    students: Array.isArray(view.students) ? view.students : [],
    availableMonths: Array.isArray(view.availableMonths) ? view.availableMonths : [],
  };
}

export async function getParentMonth(token: string, month: string): Promise<ParentMonthView | null> {
  const snapshot = await getDoc(doc(db, 'parentViews', token, 'months', month));
  return snapshot.exists() ? mapDocument<ParentMonthView>(snapshot.data(), snapshot.id) : null;
}
