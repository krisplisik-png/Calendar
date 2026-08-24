import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { DateTime } from 'luxon';
import { countParticipantLessons, getMonthPeriod, getPaymentStatus } from '../domain/payments';
import { savePayment, subscribeToPayments, updateGroup } from '../data/firestore';
import { humanizeFirebaseError } from '../lib/errors';
import type { Group, Lesson, Payment, UserProfile } from '../types';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const kindLabel = { individual: 'Индивидуал', pair: 'Пара', group: 'Группа' } as const;

export function PaymentsPage({ profile, groups, lessons, onError }: { profile: UserProfile; groups: Group[]; lessons: Lesson[]; onError: (message: string) => void }) {
  const [month, setMonth] = useState(DateTime.now().toFormat('yyyy-MM'));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Payment['status']>('all');
  const [drafts, setDrafts] = useState<Record<string, { due: string; paid: string; method: Payment['paymentMethod']; notes: string }>>({});
  const paymentMap = useMemo(() => new Map(payments.map(item => [item.participantId, item])), [payments]);

  useEffect(() => subscribeToPayments(profile.schoolId, month, items => {
    setPayments(items);
    setDrafts(Object.fromEntries(items.map(item => [item.participantId, { due: String(item.amountDue), paid: String(item.amountPaid), method: item.paymentMethod, notes: item.notes ?? '' }])));
  }, error => onError(humanizeFirebaseError(error))), [profile.schoolId, month, onError]);

  const rows = groups.map(group => {
    const payment = paymentMap.get(group.id);
    const counts = countParticipantLessons(lessons, group.id, month);
    const target = group.monthlyLessonTarget ?? 8;
    const draft = drafts[group.id] ?? { due: payment ? String(payment.amountDue) : '', paid: payment ? String(payment.amountPaid) : '', method: payment?.paymentMethod, notes: payment?.notes ?? '' };
    const due = Number(draft.due) || 0; const paid = Number(draft.paid) || 0;
    return { group, payment, counts, target, draft, due, paid, status: getPaymentStatus(due, paid) };
  }).filter(row => row.group.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).filter(row => filter === 'all' || row.status === filter);

  const totals = rows.reduce((value, row) => ({ due: value.due + row.due, paid: value.paid + row.paid }), { due: 0, paid: 0 });
  const period = getMonthPeriod(month);
  const monthDate = DateTime.fromFormat(month, 'yyyy-MM').setLocale('ru');
  function changeMonth(delta: number) { setMonth(monthDate.plus({ months: delta }).toFormat('yyyy-MM')); }
  function updateDraft(id: string, patch: Partial<(typeof drafts)[string]>) {
    setDrafts(current => {
      const previous = current[id];
      return { ...current, [id]: { due: previous?.due ?? '', paid: previous?.paid ?? '', method: previous?.method, notes: previous?.notes ?? '', ...patch } };
    });
  }
  async function changeTarget(group: Group, target: number) { try { await updateGroup(group.id, { monthlyLessonTarget: target as Group['monthlyLessonTarget'] }); } catch (error) { onError(humanizeFirebaseError(error)); } }
  async function persist(row: (typeof rows)[number]) {
    try {
      const nowUser = profile.email;
      await savePayment({ id: `${profile.schoolId}_${row.group.id}_${month}`, schoolId: profile.schoolId, participantId: row.group.id, participantNameSnapshot: row.group.name, participantKind: row.group.kind ?? 'group', month, periodStart: period.start, periodEnd: period.end, plannedLessons: row.target, scheduledLessons: row.counts.scheduled, completedLessons: row.counts.completed, amountDue: row.due, amountPaid: row.paid, currency: 'RUB', status: row.status, paymentMethod: row.draft.method, notes: row.draft.notes, createdBy: row.payment?.createdBy ?? nowUser, updatedBy: nowUser });
    } catch (error) { onError(humanizeFirebaseError(error)); }
  }

  return <section className="payments-page">
    <header className="payments-header"><div><p className="eyebrow">ФИНАНСЫ ШКОЛЫ</p><h1>Оплаты</h1><span>Период: {DateTime.fromISO(period.start).setLocale('ru').toFormat('d MMMM')} — {DateTime.fromISO(period.end).setLocale('ru').toFormat('d MMMM yyyy')}</span></div><div className="month-switch"><button onClick={() => changeMonth(-1)}><ChevronLeft /></button><strong>{monthDate.toFormat('LLLL yyyy')}</strong><button onClick={() => changeMonth(1)}><ChevronRight /></button><button onClick={() => setMonth(DateTime.now().toFormat('yyyy-MM'))}>Текущий месяц</button></div></header>
    <div className="payment-summary"><article><span>Начислено</span><strong>{money.format(totals.due)}</strong></article><article><span>Получено</span><strong>{money.format(totals.paid)}</strong></article><article><span>Осталось получить</span><strong>{money.format(Math.max(totals.due - totals.paid, 0))}</strong></article><article><span>Оплачено полностью</span><strong>{rows.filter(row => row.status === 'paid').length}</strong></article></div>
    <div className="payments-tools"><label className="search-box"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Найти ученика или группу" /></label><div className="payment-filters">{([['all', 'Все'], ['unpaid', 'Не оплачено'], ['partial', 'Частично'], ['paid', 'Оплачено']] as const).map(item => <button className={filter === item[0] ? 'active' : ''} onClick={() => setFilter(item[0])} key={item[0]}>{item[1]}</button>)}</div></div>
    <div className="payments-table"><div className="payments-row payments-table-head"><span>Участник</span><span>Уроки</span><span>К оплате</span><span>Оплачено</span><span>Статус</span><span>Способ</span><span /></div>{rows.map(row => <div className="payments-row" key={row.group.id}><div><strong>{row.group.name}</strong><small>{kindLabel[row.group.kind ?? 'group']}</small></div><div className="lesson-plan"><select value={row.target} onChange={event => changeTarget(row.group, Number(event.target.value))}>{[6,7,8,9,10].map(value => <option value={value} key={value}>План {value}</option>)}</select><small>{row.counts.scheduled} запланировано · {row.counts.completed} проведено</small></div><input type="number" min="0" value={row.draft.due} onChange={event => updateDraft(row.group.id, { due: event.target.value })} placeholder="0 ₽" /><input type="number" min="0" value={row.draft.paid} onChange={event => updateDraft(row.group.id, { paid: event.target.value })} placeholder="0 ₽" /><span className={`payment-status ${row.status}`}>{row.status === 'paid' ? 'Оплачено' : row.status === 'partial' ? 'Частично' : 'Не оплачено'}</span><select value={row.draft.method ?? ''} onChange={event => updateDraft(row.group.id, { method: (event.target.value || undefined) as Payment['paymentMethod'] })}><option value="">Не указан</option><option value="cash">Наличные</option><option value="transfer">Перевод</option><option value="other">Другое</option></select><button className="primary-button save-payment" onClick={() => persist(row)}>Сохранить</button></div>)}</div>
    {!rows.length && <div className="payments-empty">Нет участников или оплат по выбранному фильтру.</div>}
  </section>;
}
