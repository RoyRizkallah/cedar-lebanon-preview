// Regenerate src/lib/commandSlots.js after adding or changing a command: node scripts/gen-command-slots.mjs
import { FUNCTIONS } from '../src/lib/commands.js';
import { slotsFromSource, writeSlots } from './lib/command-slots.mjs';
writeSlots(slotsFromSource(FUNCTIONS));
console.log('Wrote src/lib/commandSlots.js');
