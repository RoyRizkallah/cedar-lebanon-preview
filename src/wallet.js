const seedTransactions = [
  { id: 'WLT-P1042-001', patientId: 'P-1042', type: 'credit', amountCents: 35000, description: 'Opening wallet balance', date: '2026-10-15', recordedBy: 'Rana Saliba', note: 'Opening balance entered for the fictional preview.' },
  { id: 'WLT-P1042-002', patientId: 'P-1042', type: 'purchase', amountCents: 5000, description: 'Personal care pack', date: '2026-10-17', recordedBy: 'Nadia Khoury', note: 'Requested by resident and handed over at the desk.' },
  { id: 'WLT-P1037-001', patientId: 'P-1037', type: 'credit', amountCents: 25000, description: 'Opening wallet balance', date: '2026-10-14', recordedBy: 'Rana Saliba', note: 'Opening balance entered for the fictional preview.' },
  { id: 'WLT-P1037-002', patientId: 'P-1037', type: 'purchase', amountCents: 6500, description: 'Laundry service', date: '2026-10-16', recordedBy: 'Karim Daher', note: 'Weekly laundry request completed.' }
];

let transactionSequence = 0;
let orderSequence = 0;

export function ensureWalletData(data) {
  if (!data || typeof data !== 'object') throw new TypeError('Wallet data needs a workspace object.');
  if (!Array.isArray(data.walletTransactions)) data.walletTransactions = [];
  if (!Array.isArray(data.walletOrders)) data.walletOrders = [];
  const patientIdsToSeed = [...new Set(seedTransactions.map(item => item.patientId))];
  for (const patientId of patientIdsToSeed) {
    if (!data.walletTransactions.some(item => item.patientId === patientId)) {
      data.walletTransactions.push(...seedTransactions.filter(item => item.patientId === patientId).map(item => ({ ...item })));
    }
  }
  return data;
}

export function walletTransactionsFor(data, patientId) {
  return (data?.walletTransactions || [])
    .filter(item => item.patientId === patientId)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}

export function walletBalanceCents(data, patientId) {
  return (data?.walletTransactions || []).reduce((balance, item) => {
    if (item.patientId !== patientId) return balance;
    const amount = Number(item.amountCents);
    if (!Number.isSafeInteger(amount) || amount <= 0) return balance;
    if (item.type === 'credit') return balance + amount;
    if (item.type === 'purchase') return balance - amount;
    return balance;
  }, 0);
}

function amountToCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter a positive amount with up to two decimal places.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Enter an amount greater than $0.00.');
  return cents;
}

function createTransaction(data, payload, type) {
  ensureWalletData(data);
  const patientId = String(payload?.patientId || '').trim();
  if (!patientId || !data.patients?.some(patient => patient.id === patientId)) throw new Error('Choose a patient in the center roster.');
  const description = String(payload?.description || '').trim();
  if (!description) throw new Error(type === 'credit' ? 'Describe this wallet top-up.' : 'Describe the item or service provided.');
  const amountCents = amountToCents(payload?.amount);
  if (type === 'purchase' && amountCents > walletBalanceCents(data, patientId)) throw new Error('This purchase is higher than the available wallet balance.');

  transactionSequence += 1;
  const transaction = {
    id: 'WLT-' + Date.now() + '-' + transactionSequence,
    patientId,
    type,
    amountCents,
    description,
    date: String(payload?.date || new Date().toISOString().slice(0, 10)),
    recordedBy: String(payload?.recordedBy || 'Cedar staff').trim(),
    note: String(payload?.note || '').trim()
  };
  data.walletTransactions.unshift(transaction);
  return transaction;
}

export function addWalletDeposit(data, payload) {
  return createTransaction(data, payload, 'credit');
}

export function addWalletPurchase(data, payload) {
  return createTransaction(data, payload, 'purchase');
}

export function walletOrdersFor(data, patientId) {
  return (data?.walletOrders || []).filter(order => order.patientId === patientId).slice()
    .sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)) || String(b.id).localeCompare(String(a.id)));
}

export function createWalletOrder(data, payload) {
  ensureWalletData(data);
  const patientId = String(payload?.patientId || '').trim();
  const patient = data.patients?.find(item => item.id === patientId && item.status !== 'Archived' && item.program === 'Residential');
  if (!patient) throw new Error('Choose an active residential resident.');
  const item = String(payload?.item || '').trim();
  const quantity = Number(payload?.quantity);
  const note = String(payload?.note || '').trim();
  if (item.length < 2 || item.length > 100) throw new Error('Describe the item in 2 to 100 characters.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Choose a quantity from 1 to 20.');
  if (note.length > 300) throw new Error('Keep the request note within 300 characters.');
  const order = { id: `ORD-${Date.now()}-${++orderSequence}`, patientId, item, quantity, note, status: 'Requested', requestedAt: new Date().toISOString(), createdBy: String(payload?.createdBy || patient.name || patientId).trim() };
  data.walletOrders.unshift(order);
  return order;
}

function pendingOrder(data, payload) {
  const order = (Array.isArray(data?.walletOrders) ? data.walletOrders : []).find(item => item.id === payload?.orderId);
  if (!order) throw new Error('This order could not be found.');
  if (order.status !== 'Requested') throw new Error('This order has already been closed.');
  if (payload?.patientId && order.patientId !== payload.patientId) throw new Error('This order belongs to another resident.');
  return order;
}

export function cancelWalletOrder(data, payload) {
  const order = pendingOrder(data, payload);
  Object.assign(order, { status: 'Cancelled', closedAt: new Date().toISOString(), closedBy: String(payload?.cancelledBy || payload?.patientId || 'Resident') });
  return order;
}

export function declineWalletOrder(data, payload) {
  const order = pendingOrder(data, payload);
  const reason = String(payload?.note || '').trim();
  if (reason.length < 3 || reason.length > 240) throw new Error('Add a brief reason for declining this request.');
  Object.assign(order, { status: 'Declined', closedAt: new Date().toISOString(), closedBy: String(payload?.declinedBy || 'Cedar staff'), staffNote: reason });
  return order;
}

export function fulfillWalletOrder(data, payload) {
  const order = pendingOrder(data, payload);
  const patient = data.patients?.find(item => item.id === order.patientId && item.status !== 'Archived' && item.program === 'Residential');
  if (!patient) throw new Error('This resident account is no longer active.');
  const note = String(payload?.note || '').trim();
  if (note.length > 240) throw new Error('Keep the fulfillment note within 240 characters.');
  const amountCents = amountToCents(payload?.amount);
  if (amountCents > walletBalanceCents(data, order.patientId)) throw new Error('This purchase is higher than the available wallet balance.');
  const transaction = addWalletPurchase(data, { patientId: order.patientId, amount: payload?.amount, description: `${order.quantity} × ${order.item}`, note, date: payload?.date, recordedBy: payload?.recordedBy });
  transaction.orderId = order.id;
  Object.assign(order, { status: 'Fulfilled', actualCostCents: transaction.amountCents, transactionId: transaction.id, fulfilledAt: new Date().toISOString(), fulfilledBy: transaction.recordedBy, staffNote: note });
  return order;
}
