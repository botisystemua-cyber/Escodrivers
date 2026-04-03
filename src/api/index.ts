import { CONFIG } from '../config';
import type { Route, ShippingRoute, Passenger, Package, ShippingItem, RouteItem, ExpenseItem, ExpenseAdvance } from '../types';

// ============================================
// Всі дані читаються через Apps Script (таблиця непублічна)
// Apps Script повертає готові JSON-об'єкти
// ============================================

async function apGet(action: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ action, ...params }).toString();
  const response = await fetch(CONFIG.API_URL + '?' + query);
  if (!response.ok) throw new Error('Помилка запиту: ' + action);
  const text = await response.text();
  return JSON.parse(text);
}

async function apPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Помилка запиту: ' + (body.action || 'unknown')); }
}

// ---- Routes ----
export async function fetchRoutes(): Promise<{ routes: Route[]; shipping: ShippingRoute[] }> {
  try {
    const data = await apGet('getAvailableRoutes');
    if (data.success) return { routes: data.routes as Route[], shipping: data.shipping as ShippingRoute[] };
  } catch { /* fallback to config */ }
  return {
    routes: CONFIG.ROUTES.map((name) => ({ name, count: 0 })),
    shipping: CONFIG.SHIPPING.map((s) => ({ ...s, count: 0 })),
  };
}

// ---- Passengers ----
export async function fetchPassengers(sheetName: string): Promise<Passenger[]> {
  const data = await apGet('getPassengers', { sheet: sheetName });
  if (!data.success) throw new Error((data.error as string) || 'Помилка завантаження пасажирів');
  const items = (data.items || []) as Passenger[];
  return items.map((item) => ({
    ...item,
    status: item.status || 'pending',
    _statusKey: '',
    _sourceRoute: undefined,
  }));
}

// ---- Packages ----
export async function fetchPackages(sheetName: string): Promise<Package[]> {
  const data = await apGet('getPackages', { sheet: sheetName });
  if (!data.success) throw new Error((data.error as string) || 'Помилка завантаження посилок');
  const items = (data.items || []) as Package[];
  return items.map((item) => ({
    ...item,
    status: item.status || 'pending',
    _statusKey: '',
    _sourceRoute: undefined,
  }));
}

// ---- Shipping (read-only) ----
export async function fetchShippingItems(sheetName: string): Promise<ShippingItem[]> {
  const data = await apGet('getShippingItems', { sheet: sheetName });
  if (!data.success) throw new Error((data.error as string) || 'Помилка завантаження відправок');
  const items = (data.items || []) as ShippingItem[];
  return items.map((item) => ({
    ...item,
    _statusKey: '',
    _sourceRoute: undefined,
  }));
}

// ---- Status Update ----
export async function updateItemStatus(
  driverName: string,
  routeName: string,
  item: RouteItem | { itemId: string; type: string },
  status: string,
  cancelReason = ''
) {
  const itemId = 'dispatchId' in item ? (item as ShippingItem).dispatchId : (item as Passenger | Package).itemId;
  const itemType = 'dispatchId' in item ? 'відправка' : (item as Passenger | Package).type;
  const phone = 'phone' in item ? (item as Passenger).phone : ('recipientPhone' in item ? (item as Package | ShippingItem).recipientPhone : '');

  return apPost({
    action: 'updateDriverStatus',
    driverId: driverName,
    routeName,
    itemId,
    itemType,
    phone,
    status,
    cancelReason,
  });
}

// ---- Expenses ----
export async function fetchExpenses(routeName: string): Promise<{ items: ExpenseItem[]; advance: ExpenseAdvance | null }> {
  const sheetName = routeName.replace('Маршрут_', 'Витрати_');
  const data = await apGet('getExpenses', { sheet: sheetName });
  if (data.success) return { items: (data.items || []) as ExpenseItem[], advance: (data.advance || null) as ExpenseAdvance | null };
  throw new Error((data.error as string) || 'Помилка завантаження витрат');
}

export async function addExpense(data: Record<string, string>) {
  return apPost({ action: 'addExpense', ...data });
}

export async function deleteExpense(data: Record<string, string>) {
  return apPost({ action: 'deleteExpense', ...data });
}

// ---- Update advance ----
export async function updateAdvance(data: Record<string, string>) {
  return apPost({ action: 'updateAdvance', ...data });
}

// ---- Add new item (passenger or package) ----
export async function addRouteItem(data: Record<string, string>) {
  return apPost({ action: 'addRouteItem', ...data });
}
