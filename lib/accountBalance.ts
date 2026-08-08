/**
 * Calcolo del saldo corrente di un conto, condiviso tra la pagina Conti e la Panoramica
 * cosi' che mostrino sempre lo stesso numero (centralizzato per evitare che una delle due
 * resti indietro se la logica cambia, come gia' successo in passato con i colori categoria).
 */

import { type Account, type AccountBalanceAdjustment } from "@/lib/types/database";
import { toLocalDateStr } from "@/lib/format";

interface ExpenseLike {
  account_id: string | null;
  amount: number | string;
  is_income: boolean;
  date: string;
}

/**
 * Per ogni conto, l'aggiornamento manuale del saldo piu' recente con data non futura
 * (o undefined se non ce n'e' nessuno).
 */
export function getLatestAdjustments(
  accounts: Account[],
  adjustments: AccountBalanceAdjustment[],
  asOfDate: string = toLocalDateStr()
): Record<string, AccountBalanceAdjustment | undefined> {
  const byAccount: Record<string, AccountBalanceAdjustment[]> = {};
  adjustments.forEach((a) => {
    (byAccount[a.account_id] ||= []).push(a);
  });
  Object.values(byAccount).forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));

  const map: Record<string, AccountBalanceAdjustment | undefined> = {};
  accounts.forEach((acc) => {
    const list = (byAccount[acc.id] || []).filter((adj) => adj.date <= asOfDate);
    map[acc.id] = list[list.length - 1];
  });
  return map;
}

/**
 * Saldo corrente per conto: dall'ultimo aggiornamento manuale del saldo (se presente) o dal
 * saldo iniziale, + entrate collegate - uscite collegate successive alla data dell'aggiornamento
 * (i movimenti precedenti sono gia' compresi nel saldo osservato manualmente, quindi non vanno
 * sommati di nuovo).
 */
export function computeAccountBalances(
  accounts: Account[],
  expenses: ExpenseLike[],
  adjustments: AccountBalanceAdjustment[],
  asOfDate: string = toLocalDateStr()
): Record<string, number> {
  const latestByAccount = getLatestAdjustments(accounts, adjustments, asOfDate);
  const map: Record<string, number> = {};
  accounts.forEach((acc) => {
    const latest = latestByAccount[acc.id];
    let balance = latest ? Number(latest.balance) : Number(acc.initial_balance);
    expenses.forEach((e) => {
      if (e.account_id !== acc.id) return;
      if (latest && e.date <= latest.date) return;
      balance += e.is_income ? Number(e.amount) : -Number(e.amount);
    });
    map[acc.id] = balance;
  });
  return map;
}
