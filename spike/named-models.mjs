/**
 * What Auto now sees behind the model trigger, through its own code path.
 *
 * Read-only: `namedModels` opens the picker, crosses whichever sheet is in
 * front of the list, writes the rows down and closes it again. Nothing is
 * chosen, so a chat's model is unchanged.
 *
 * Usage: node spike/named-models.mjs [threadId]
 */
import { CursorCdp } from '../src/core/cursor-cdp.mjs';

const cursor = new CursorCdp();
const windows = await cursor.windows();
for (const w of windows) {
  console.log(`${w.title} — chat ${w.threadId}`);
}

const threadId = process.argv[2] || windows.find((w) => w.hasComposer)?.threadId;
if (!threadId) {
  console.log('no Cursor window with a chat box');
  process.exit(1);
}

console.log(`\nreading the model list for ${threadId}…`);
console.log(JSON.stringify(await cursor.namedModels({ threadId }), null, 2));
console.log('\nmodel controls:');
console.log(JSON.stringify(await cursor.modelControls({ threadId }), null, 2));

process.exit(0);
