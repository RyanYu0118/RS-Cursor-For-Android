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
generated: { by: agent, at: 2026-09-26T14:15:00Z }
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

Auto **does not** mirror Cursor's approval buttons to web, Telegram, or
Android any more. DOM flashes kept painting "Permission needed" cards that
vanished a moment later; those asks stay in the IDE. The desktop turn
watcher still polls for the **queue**, not for approval labels.

Agent `ask_question` cards still go to the phone with their real options.
ACP tool permissions use the session policy (`auto` by default).

### Automatic mode transitions

An agent may request an Agent ↔ Plan transition with `switch_mode`. Cursor
renders that on its own approval controls (**Always ask**, **Skip**,
**Switch**). Those stay in the IDE — Auto no longer relays them as phone
permission cards. Answer Skip / Switch there.

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
