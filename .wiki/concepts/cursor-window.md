---
type: Concept
title: Cursor window
description: Driving Cursor over its debug port — type, press, pick, paste — without acting on the wrong chat.
tags: [cdp, cursor, composer, pickers]
status: stable
sources:
  - id: cdp
    resource: /src/core/cursor-cdp.mjs
    title: Cursor CDP
  - id: dom
    resource: /src/core/cursor-dom.mjs
    title: Window vocabulary
  - id: launch
    resource: /src/core/cursor-launch.mjs
    title: Launch / quit Cursor
  - id: clipboard
    resource: /src/core/clipboard.mjs
    title: Image paste via clipboard
generated: { by: agent, at: 2026-09-25T15:20:00Z }
---

# The Cursor window

Launched with `--remote-debugging-port=9222`, Cursor exposes its windows as
pages. Auto puts the caret in the chat box, types, and presses Enter — the
crudest transport and the most dependable, because it is what a person at
the keyboard does. The desktop bridge can refuse for the rest of a window's
life; the debug port answers to no feature switch.

The Agents window's box is `.ui-prompt-input-editor__input`. It is not the
older `aislash-editor-input`, and it does not sit inside `[data-composer-id]`.
Missing it makes a chat that is already on screen look like it has no box,
and the message is held for a bridge that is not running. A sidebar row that
ignores a dispatched click is pressed with a real mouse, like New Agent.

Reading history is still the database's job. The window only holds what it
has scrolled into view.

## Honesty

- **Never type into the wrong conversation.** A window is written to only
  after it has proved which chat it is showing (id in markup, or the
  messages on screen looked up in the desktop database).
- **Never leave a mess.** If the box will not send, the typed text is taken
  back out and the message goes to the [bridge](desktop-bridge.md) or its outbox.
  Stopping a turn also clears Cursor's box: Cursor puts the prompt back there
  to be edited, which would block the next phone message, so Auto takes those
  words out and records them on the interrupt for the [web](web.md) / Telegram
  composer instead.

`force` exists only for putting a window back where it was.

## Pressing, not just typing

The same port stops a turn, brings a background tab to the front when a
control on it has to be pressed, and presses a control **by the words on
it**. A text message from the phone does not do that: if this chat is not
the one on screen, the [bridge](desktop-bridge.md) submits it and leaves
the desktop where it is. Cursor's class names are generated. What a
conversation says is excluded, or a message beginning "Run this…" reads as
a Run button.

Queue icon buttons carry no words — those alone are found by `codicon`
name (VS Code's icon vocabulary).

The sticky **file-review** bar (Keep All / Undo All / Redo) is pressed the
same way — by the words on it — but never as an approval. A separate
watcher keeps polling after the turn ends, because that is when the bar
usually appears. See [approvals](approvals.md).

A question is answered on Cursor's questionnaire toolbar above the chat
box — a sibling of the `ask_question` bubble, not inside it. Each option
is a lettered row ("A" in one element, "Red" in the next, often glued as
"ARed"). Auto matches the label, including that glued letter, and presses
the row then Continue with a real mouse. Continue stays disabled until a
row is chosen, so it is found even while disabled. Skip is on that
toolbar, not an approval. `spike/question-card.mjs` dumps a real card
when a press misses.

When Cursor's UI moves, `src/core/cursor-dom.mjs` is the only file that
should need to change. `spike/cdp-probe.mjs --discover` is how to find the
new selectors.

## Model and mode from the phone

The pickers beside the chat box ignore a dispatched click; they open only
on input the window believes came from a mouse, so they are pressed *where
they are*. The model trigger is compact — it often shows a parameter value
("Medium" or "High") or just "Auto", not the model name.

**The trigger never opens the model list.** It opens one of two sheets, and
both are crossed the same way, by pressing **Model**:

- a named model opens `selected-model-parameters-submenu-menu`;
- Auto-select opens `selected-auto-menu`: a line of description, a **Model**
  row, and the word "Auto" as that row's *value*.

The parameters sheet is model-specific. A GPT model can expose **Fast**,
**Context**, **Reasoning**, and **Model**; another can expose **Effort**
instead. The stable contract is the **Model** row, not any one parameter
name. Auto groups the label/value pairs by their row, opens each
`parameter-submenu-<name>` to discover its options, and mirrors the result
on web and Telegram. Fast is a switch; Context, Reasoning, and Effort are
selects. No option list is hard-coded.

A sheet is told from the list by *source*, never by the words in it. The
list is whatever carries `model-list` items; a sheet is anything else with a
**Model** row. Ruling out the sheet by "it does not say Auto" is what broke:
the Auto sheet says Auto too, so while Auto-select was on every model name
looked missing and the phone was told the models on offer were "Balanced
quality and speed…, Model, Auto".

Behind **Model** is the real list (`selected-model-list-submenu`), with the
first card of models plainly visible — Auto-select hides nothing. Search
(`placeholder="Search models"`) is for names outside that card, and is typed
only once the caret is in that box.

**Auto-select has no off switch.** Its row (`auto-mode-select`) is a choice
in the list, not a toggle: it carries no `aria-checked`, and pressing it
while Auto is on does nothing. The only thing that leaves Auto is choosing a
model. So "Auto off" from a phone reads the list and takes Cursor's own
first row — the one it puts at the top — and the picker then says which.
`namedModels` is that read: rows only, since a badge beside a row ("Max",
"High Fast") is a variant, not a model.

The web composer carries the Auto switch itself, beside the mode chip, and
hides the model chip while Auto is on — an Auto chat has no model to show.
Tapping the model chip opens a settings dialog (bottom sheet on phones)
where Model opens a searchable list and the model-specific parameters are
labelled rows. Auto is not offered inside that sheet; it is the switch
outside it.

The phone paints that sheet from `src/web/model-parameters.js`, a snapshot of
the knobs Cursor offered (Fast, Context, Effort, and the rest). Opening it
does not press the window. The phone and the computer share the loaded
chat's model. A change on the phone is written with Cursor's model-config
service (`setModelConfigForComposer`) — the menu is not opened — and read
back before anything is sent. A change on the computer is read from that
same loaded config and shown on the phone. Auto is `default`. A desktop
chat that has no model stored on the session is shown from that record —
an empty choice is not Auto. When Cursor changes those knobs, replace the
snapshot.

Unsent words in the chat box are shared the same way. Typing on the phone
writes Cursor's composer `text` / `richText` through the chat service and
fires `ShouldForceText` — the box updates without focusing the window.
Typing on the computer is read from the open editor when that chat is
showing, otherwise from the loaded composer, and shown on the phone.
Clearing either box clears the other, including an empty ProseMirror
document. When the two boxes disagree, the side that presses send is the
message that goes: a phone send replaces the computer box, and a computer
send leaves that text and clears the phone.

Modes are the @-mention popover. A model row is named from
`model-item-*` minus Edit and the badges, because "Composer" and "2.5"
live in separate children. Mode items are still own-text, never the
subtree — or "Opus 5" holding a "High" badge reads as "Opus 5 HighEdit".
A variant is the row then the badge on it — except a badge can itself hold
more than one word: Grok's row says "High Fast" in a single span, one
press for both, not two. Reading it as one word only left "Fast" glued to
the next row's "New" tag into "FastNew" and Grok unreachable; either word
in "High Fast" now finds that same press.

The phone's named-model picker sends agent ids
(`kimi-k3[reasoning=max]`), not menu words. The catalog often names that
row `kimi-k3` too. Hyphens are spaces (`kimi-k3` is "Kimi K3"), and a slug
can omit a prefix the menu adds (`grok-4.6` is "Cursor Grok 4.6").
Parameter changes after model selection use Cursor's separate controls,
not a guessed model-id suffix.

The compact trigger staying on "High" after a switch is not proof it
missed. Asking for what the trigger already says presses nothing.

An agent-requested Agent ↔ Plan transition is different from choosing the
picker from the phone: Cursor first displays an approval. Auto recognizes
the observed **Switch** and **Skip** controls, removes Switch's inline `^↵`
key hint, sends those choices through [approvals](approvals.md), and presses
the selected wording in the same chat. It does not infer or force the mode
itself.

## Pictures

There is no protocol command for attaching a file. An image from a phone
goes onto the Windows clipboard and the window is told to run its own
`paste` editing command. Each image is confirmed by a pill beside the chat
box before the next one goes. Whatever text was on the clipboard is put
back. An existing image on the clipboard cannot be restored. Words are sent
even if the picture would not attach, with a note saying what was left
behind. The outbox holds words only.

## Launching Cursor

A running instance that already has the debug port takes `--new-window`.
Starting from nothing adds the port so the window is born reachable. Cursor
already running *without* the port cannot have it added — Electron hands
the folder over and exits — so the only fix is quit+relaunch, which closes
every window. Auto refuses that by default and falls back to ACP with a
notice. Set `AUTO_ALLOW_CURSOR_RESTART=1` only when you mean to force the
kill.

The executable is the usual install path, or `CURSOR_PATH`, or the path of
the Cursor process that is already running. A copy under something like
`D:\app\cursor` is still launched. Missing that path used to report "not
installed" and leave the phone session only in Auto, so the computer window
never showed the chat and never called the model.

## Related

- [Desktop chats](desktop-chats.md)
- [Desktop bridge](desktop-bridge.md)
- [Queue](queue.md)
- [Approvals](approvals.md)
