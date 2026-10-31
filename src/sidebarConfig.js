export const sidebarConfig = {
  Director: {
    title: 'Center command',
    subtitle: 'Whole-center oversight',
    icon: 'grid',
    sections: [
      { label: 'Command', items: [['overview', 'Center overview', 'grid'], ['reports', 'Center reports', 'chart'], ['assist', 'Cedar Intelligence', 'sparkle']] },
      { label: 'Care operations', items: [['admissions', 'Admissions', 'inbox'], ['patients', 'Patient records', 'users'], ['schedule', 'Team schedule', 'calendar'], ['rooms', 'Rooms & beds', 'bed'], ['aftercare', 'Aftercare', 'heart']] },
      { label: 'Finance control', items: [['billing', 'Invoices', 'document'], ['payments', 'Payments', 'wallet'], ['wallets', 'Resident wallets', 'wallet'], ['expenses', 'Expenses', 'inbox'], ['ledger', 'General ledger', 'chart'], ['reconciliation', 'Reconciliation', 'check'], ['payers', 'Payer accounts', 'users']] }
    ],
    focus: { label: 'CENTER PULSE', text: 'Intake files awaiting a decision', page: 'admissions', icon: 'inbox' }
  },
  Coordinator: {
    title: 'Coordination desk',
    subtitle: 'Admissions & continuity',
    icon: 'users',
    sections: [
      { label: 'My day', items: [['overview', 'Coordinator home', 'grid'], ['handoffs', 'Handoff queue', 'check']] },
      { label: 'Intake & placement', items: [['admissions', 'Intake pipeline', 'inbox'], ['rooms', 'Placement board', 'bed']] },
      { label: 'Continuity of care', items: [['patients', 'Patient records', 'users'], ['schedule', 'Team schedule', 'calendar'], ['aftercare', 'Follow-through', 'heart']] },
      { label: 'Insight', items: [['reports', 'Operations reports', 'chart'], ['assist', 'Admissions intelligence', 'sparkle']] }
    ],
    focus: { label: 'NEXT HANDOFF', text: 'Open files assigned to you', page: 'handoffs', icon: 'check' }
  },
  Therapist: {
    title: 'Clinical workspace',
    subtitle: 'Your assigned caseload',
    icon: 'heart',
    sections: [
      { label: 'My day', items: [['overview', 'Therapist home', 'grid'], ['schedule', 'My sessions', 'calendar']] },
      { label: 'My caseload', items: [['patients', 'Patient records', 'users'], ['careplans', 'Care-plan worklist', 'heart'], ['clinicalreports', 'Clinical reports', 'document']] },
      { label: 'Follow-through', items: [['aftercare', 'My follow-ups', 'check']] }
    ],
    focus: { label: 'CARE-PLAN WATCH', text: 'Open goals in your caseload', page: 'careplans', icon: 'heart' }
  },
  Finance: {
    title: 'Finance office',
    subtitle: 'Accounting & payments',
    icon: 'wallet',
    sections: [
      { label: 'Desk overview', items: [['overview', 'Finance home', 'grid']] },
      { label: 'Receivables', items: [['billing', 'Invoice ledger', 'document'], ['payments', 'Payment register', 'wallet'], ['wallets', 'Resident wallets', 'wallet'], ['payers', 'Payer accounts', 'users']] },
      { label: 'Payables', items: [['expenses', 'Supplier expenses', 'inbox']] },
      { label: 'Accounting', items: [['ledger', 'General ledger', 'chart'], ['reconciliation', 'Bank reconciliation', 'check'], ['reports', 'Financial reports', 'chart']] }
    ],
    focus: { label: 'BANK MATCHING', text: 'Statement lines to reconcile', page: 'reconciliation', icon: 'check' }
  },
  Reception: {
    title: 'Welcome desk',
    subtitle: 'First contact & arrivals',
    icon: 'inbox',
    sections: [
      { label: 'Front desk', items: [['overview', 'Desk home', 'grid'], ['admissions', 'Intake desk', 'inbox'], ['arrivals', 'Planned arrivals', 'calendar']] },
      { label: 'Today’s logistics', items: [['schedule', 'Desk schedule', 'clock'], ['rooms', 'Room readiness', 'bed']] }
    ],
    focus: { label: 'WELCOME LIST', text: 'Arrivals assigned to your desk', page: 'arrivals', icon: 'calendar' }
  },
  RSA: {
    title: 'Resident support',
    subtitle: 'Daily care & practical support',
    icon: 'heart',
    sections: [
      { label: 'My day', items: [['overview', 'Support home', 'grid'], ['checkins', 'Daily check-ins', 'check']] },
      { label: 'Residents', items: [['caseload', 'My residents', 'users']] },
      { label: 'Center services', items: [['wallets', 'Wallets & orders', 'wallet']] }
    ],
    focus: { label: 'TODAY’S CHECK-INS', text: 'Residents still to check in today', page: 'checkins', icon: 'check' }
  },
  Resident: {
    title: 'My Cedar space',
    subtitle: 'Stay details & center account',
    icon: 'heart',
    sections: [
      { label: 'My space', items: [['overview', 'My home', 'grid'], ['wallet', 'My wallet', 'wallet'], ['orders', 'My orders', 'inbox']] }
    ],
    focus: { label: 'MY WALLET', text: 'Check your current balance and purchases', page: 'wallet', icon: 'wallet' }
  }
};
