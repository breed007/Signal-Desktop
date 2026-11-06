// Copyright 2026 Mike Simone
// SPDX-License-Identifier: AGPL-3.0-only

// Message reminders (decision F49), as Backchannel Android: "Remind me" on a
// message, at a time you pick. Signal has no such thing and nothing syncs,
// so the helper keeps them in its config folder (reminders.json, mode
// 0600) and tells open pages when one comes due. A reminder that came due
// with no page open waits, marked due, until a page shows it.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export const MAX_REMINDERS = 500;
// setTimeout's limit; later reminders are checked again when it fires.
const MAX_DELAY_MS = 2 ** 31 - 1;

export class Reminders {
  #file;
  #items = [];
  #timer = null;
  #onDue;
  #now;

  constructor(file, { onDue = () => {}, now = Date.now } = {}) {
    this.#file = file;
    this.#onDue = onDue;
    this.#now = now;
    if (file && existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'));
        if (Array.isArray(parsed)) {
          this.#items = parsed.filter(isItem);
        }
      } catch {
        this.#items = [];
      }
    }
  }

  list() {
    return this.#items.map(item => ({ ...item }));
  }

  add({ conversationId, messageId, at, preview }) {
    if (
      !this.#file ||
      typeof conversationId !== 'string' ||
      !conversationId ||
      conversationId.length > 128 ||
      typeof messageId !== 'string' ||
      !messageId ||
      messageId.length > 128 ||
      !Number.isFinite(at) ||
      at < this.#now() - 60_000 ||
      at > this.#now() + 5 * 366 * 24 * 60 * 60 * 1000 ||
      this.#items.length >= MAX_REMINDERS
    ) {
      return null;
    }
    const item = {
      id: randomUUID(),
      conversationId,
      messageId,
      at: Math.round(at),
      preview: String(preview ?? '').slice(0, 300),
      due: false,
    };
    this.#items.push(item);
    this.#save();
    this.#schedule();
    return { ...item };
  }

  remove(id) {
    const before = this.#items.length;
    this.#items = this.#items.filter(item => item.id !== id);
    if (this.#items.length === before) {
      return false;
    }
    this.#save();
    this.#schedule();
    return true;
  }

  start() {
    this.#fire();
  }

  stop() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #fire() {
    const now = this.#now();
    let changed = false;
    for (const item of this.#items) {
      if (!item.due && item.at <= now) {
        item.due = true;
        changed = true;
        this.#onDue({ ...item });
      }
    }
    if (changed) {
      this.#save();
    }
    this.#schedule();
  }

  #schedule() {
    clearTimeout(this.#timer);
    this.#timer = null;
    const next = Math.min(
      ...this.#items.filter(item => !item.due).map(item => item.at)
    );
    if (!Number.isFinite(next)) {
      return;
    }
    const delay = Math.min(Math.max(0, next - this.#now()), MAX_DELAY_MS);
    this.#timer = setTimeout(() => this.#fire(), delay);
    this.#timer.unref?.();
  }

  #save() {
    const tmp = `${this.#file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.#items), { mode: 0o600 });
    renameSync(tmp, this.#file);
  }
}

function isItem(item) {
  return (
    item &&
    typeof item.id === 'string' &&
    typeof item.conversationId === 'string' &&
    typeof item.messageId === 'string' &&
    Number.isFinite(item.at)
  );
}
