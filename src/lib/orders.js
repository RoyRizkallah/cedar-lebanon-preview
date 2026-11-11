// The order register (Structure & Delegation, Part 3): every purchase made anywhere in the center follows one path.
// Shady (kitchen) or Mazen (maintenance, cleaning, supplies) raises it; up to $200 the sub-lead proceeds;
// over $200 Amer approves in writing before the purchase; kitchen orders inside Amer's standing weekly ceiling need no separate approval.
// The register is the record Administration keeps; the receipt closes each order and goes on to Finance.
import { nextId } from './ids.js';
import { todayISO, addDays } from './dates.js';
import { canDo, whoCan } from './people.js';
import { notify } from './notifications.js';
import { log } from './activity.js';

export const APPROVAL_LIMIT = 200;
export const ORDER_KINDS = ['Kitchen', 'Maintenance', 'Cleaning', 'Supplies'];
const register = state => (state.orders ||= []);
const find = (state, id) => { const order = register(state).find(item => item.id === id); if (!order) throw new Error('This order was not found.'); return order; };
const usd = value => `$${Number(value).toLocaleString('en-US')}`;

// The week runs Monday to Sunday; the kitchen ceiling is per week.
function weekOf(date) {
  const day = new Date(`${date}T12:00:00`);
  const monday = addDays(date, -((day.getDay() + 6) % 7));
  return [monday, addDays(monday, 6)];
}

// What the kitchen has committed this week under the standing ceiling.
export function kitchenSpend(state, now = new Date()) {
  const [from, to] = weekOf(todayISO(now));
  return register(state).filter(item => item.kind === 'Kitchen' && item.date >= from && item.date <= to && item.status !== 'Rejected')
    .reduce((sum, item) => sum + item.amount, 0);
}

export function setKitchenCeiling(state, amount, staffId) {
  if (!canDo(staffId, 'approveOrder')) throw new Error('The kitchen ceiling is set by Amer.');
  const value = Math.round(Number(amount));
  if (!(value >= 0)) throw new Error('Add the weekly ceiling in dollars.');
  state.kitchenCeiling = { amount: value, setBy: staffId, at: new Date().toISOString() };
  log(state, staffId, `Weekly kitchen ceiling set to ${usd(value)}`, '#/orders');
  return state.kitchenCeiling;
}

export function raiseOrder(state, { item, supplier = '', amount, kind }, staffId, now = new Date()) {
  if (!canDo(staffId, 'raiseOrder')) throw new Error('Orders are raised by Shady or Mazen.');
  if (!String(item || '').trim()) throw new Error('Say what is being ordered.');
  if (!ORDER_KINDS.includes(kind)) throw new Error('Choose kitchen, maintenance, cleaning or supplies.');
  const value = Math.round(Number(amount) * 100) / 100;
  if (!(value > 0)) throw new Error('Add the estimated cost.');
  const order = { id: nextId('ORD', register(state)), date: todayISO(now), item: item.trim(), supplier: String(supplier).trim(), kind, amount: value, requestedBy: staffId, at: now.toISOString() };
  const ceiling = state.kitchenCeiling?.amount || 0;
  if (value <= APPROVAL_LIMIT) Object.assign(order, { status: 'Approved', approval: `Within the $${APPROVAL_LIMIT} sub-lead limit` });
  else if (kind === 'Kitchen' && kitchenSpend(state, now) + value <= ceiling) Object.assign(order, { status: 'Approved', approval: `Within the ${usd(ceiling)} weekly kitchen ceiling`, withinCeiling: true });
  else {
    order.status = 'Awaiting approval';
    notify(state, { to: whoCan('approveOrder'), title: `Order to approve: ${order.item}`, body: `${usd(value)}${order.supplier ? `, ${order.supplier}` : ''}. Raised by the ${kind.toLowerCase()} lead.`, link: '#/orders' });
  }
  register(state).push(order);
  log(state, staffId, `Order raised: ${order.item} (${usd(value)})`, '#/orders');
  return order;
}

export function approveOrder(state, id, staffId, now = new Date()) {
  if (!canDo(staffId, 'approveOrder')) throw new Error('Orders over $200 are approved by Amer.');
  const order = find(state, id);
  if (order.status !== 'Awaiting approval') throw new Error('This order is not waiting for approval.');
  Object.assign(order, { status: 'Approved', approval: 'Approved in writing by Amer', approvedBy: staffId, approvedAt: now.toISOString() });
  notify(state, { to: order.requestedBy, title: `Order approved: ${order.item}`, body: usd(order.amount), link: '#/orders' });
  log(state, staffId, `Approved order ${order.id}`, '#/orders');
  return order;
}

export function rejectOrder(state, id, reason, staffId, now = new Date()) {
  if (!canDo(staffId, 'approveOrder')) throw new Error('Orders over $200 are approved by Amer.');
  const order = find(state, id);
  if (order.status !== 'Awaiting approval') throw new Error('This order is not waiting for approval.');
  if (!String(reason || '').trim()) throw new Error('Give a reason.');
  Object.assign(order, { status: 'Rejected', rejectReason: reason.trim(), approvedBy: staffId, approvedAt: now.toISOString() });
  notify(state, { to: order.requestedBy, title: `Order not approved: ${order.item}`, body: reason.trim(), link: '#/orders' });
  return order;
}

// Goods checked against the order on arrival by the requester; the receipt goes to Administration, then Finance.
export function receiveOrder(state, id, { amount, fileId, fileName = '' }, staffId, now = new Date()) {
  const order = find(state, id);
  if (order.status !== 'Approved') throw new Error('Only approved orders can be received.');
  if (staffId !== order.requestedBy && !canDo(staffId, 'raiseOrder')) throw new Error('The order is received by whoever raised it.');
  const value = Math.round(Number(amount) * 100) / 100;
  if (!(value > 0)) throw new Error('Add what was actually paid.');
  if (!fileId) throw new Error('Attach the receipt.');
  Object.assign(order, { status: 'Received', paid: value, receiptFileId: fileId, receiptName: fileName, receivedBy: staffId, receivedAt: now.toISOString() });
  log(state, staffId, `Received order ${order.id} with its receipt`, '#/orders');
  return order;
}
