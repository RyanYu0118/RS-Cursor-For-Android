---
type: Concept
title: Approvals, questions, and plans
description: Permission broker, agent question cards, Created Plan, and why Keep All is not a question.
tags: [permissions, questions, plans]
status: stable
sources:
  - id: permissions
    resource: /src/core/permissions.mjs
    title: Permission broker
  - id: questions
    resource: /src/core/questions.mjs
    title: Question cards
  - id: tools
    resource: /src/web/desktop-tool-ui.js
    title: How desktop tools are drawn
  - id: dom
    resource: /src/core/cursor-dom.mjs
    title: Cursor control vocabulary
  - id: sessions
    resource: /src/core/sessions.mjs
    title: Desktop approval watcher
generated: { by: agent, at: 2026-09-24T16:50:00Z }
---

# Approvals, questions, and plans

Four different waits look similar on a phone and must not be mixed up.

## Permission policy

ACP asks Auto to authorise a tool call and blocks until someone answers.
The first answer from the web or Telegram wins. The agent waits at least
two minutes.

| Policy | Meaning |
| --- | --- |
| `auto` | Approve everything (default, `AUTO_POLICY`) |
| `ask-on-write` | Approve reads/search/fetch/think; ask for the rest |
| `ask` | Ask every time |

A session whose policy you change keeps that choice.

## Cursor's own approvals

While a desktop turn runs, Auto watches the window for controls whose words
mean it is waiting for a person, parks them in the same broker, and presses
whichever option comes back — withdrawing the question if it is answered in
the IDE first. The vocabulary lives in `cursor-dom.mjs` (never class names).
With Cursor set to run everything automatically it rarely asks — treat the
first real sighting as a chance to learn the words Cursor actually uses.

### Automatic mode transitions

An agent may request an Agent ↔ Plan transition with `switch_mode`. Cursor
renders that request through its approval controls rather than changing mode
silently. The observed card offers **Always ask**, **Skip**, and **Switch**;
Auto relays the resolving actions, Skip and Switch, through the same permission
broker as Run / Allow. Web and Telegram therefore show the real choices, and
the selected wording is pressed back in Cursor. The `^↵` key hint rendered
inside Switch is stripped before the action is matched.

The matching is intentionally exact. “Switch mode” and “Switch chat” controls
are navigation, not approvals, and must never be offered as one. Skip is a
rejection choice; Switch is an allow choice. Cursor remains the owner of the
actual transition.

**Yes** and **No** count only when they are the whole label. "No Repo" is the
window's mark for an empty workspace, not a question, and is not sent to the
phone.

Skip and Continue **inside a chat message bubble** are not approvals: they
belong to Cursor's `ask_question` card. Offering Skip from that card as
"Permission needed" was the first wild miss — the card is drawn before its
options are written, and those two words are otherwise indistinguishable
from an approval.

## The file-review bar is not a question

"Keep All" and "Undo All" sit on Cursor's sticky bar for as long as a chat
has unreviewed edits. Offering them as approvals meant offering to throw work
away by accident. They are excluded from the approval vocabulary.

Auto does **not** mirror that bar on web or Telegram. Cursor only exposes
global Keep / Undo / Redo — not per-edit "roll back to here" — so those
buttons are not offered on the phone. The **N Files Changed** list under a
finished answer is separate: it shows which files the turn edited. Review
changes in the IDE. Only short
exact button labels are recognised when filtering approvals — a chat titled
"Undo and redo…" is not Undo. "Review next file" is IDE navigation. ACP
sessions have no review bar.

## Question cards

`ask_question` is not an approval: it holds real options, often several
questions. The phone letters them (`A`, or `1A` when there are several) so
a tap or a typed `A` / `1B` presses that option in Cursor and Continue.
Cursor draws those options on a questionnaire toolbar above the chat box,
not inside the tool bubble. The letter and the label are separate nodes
(often glued as "ARed"); Auto matches the stored label, including that
prefix, and falls back to the Nth row. Continue is disabled until a row is
chosen, so it is located anyway and pressed after the option. `Skip` is
still there, on that toolbar, not as a permission. Anything that is not a
lettered pick is a message, not an answer — a thought that happened to
start with a letter must not vanish into the question. Answering in the
IDE first still works; Auto notices and marks it answered.

## Created Plan

`create_plan` is a card: title, overview, View Plan for the markdown, and
Build with a model picker. Build presses Cursor's own button on that card,
after choosing the model there if one was named. Telegram gets the same two
actions.

On the web, View Plan opens the markdown full-window (like Settings): title
in the header, × or Escape to close, and Build with its model picker stuck as
a footer under the scrolling text. Repo-path links in the plan
(`[file](src/…)`) render as the file name in code, not raw brackets.

## Related

- [Cursor window](cursor-window.md)
- [Tool lanes](tool-lanes.md)
- [Telegram](telegram.md)
- [Web](web.md)
