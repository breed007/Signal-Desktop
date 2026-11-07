// Copyright 2026 Mike Simone
// SPDX-License-Identifier: AGPL-3.0-only

// Keyword alerts (decision F50), as Backchannel Android: words that make a
// message in a muted chat notify anyway. Kept in the helper's config folder
// (keywords.json, mode 0600) so every open page uses the same list.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const MAX_WORDS = 50;
const MAX_WORD = 64;

export function cleanKeywords(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const word = String(raw ?? '')
      .trim()
      .slice(0, MAX_WORD);
    if (word && !seen.has(word.toLowerCase()) && out.length < MAX_WORDS) {
      seen.add(word.toLowerCase());
      out.push(word);
    }
  }
  return out;
}

export class KeywordAlerts {
  #file;
  #words = [];

  constructor(file) {
    this.#file = file;
    if (file && existsSync(file)) {
      try {
        this.#words = cleanKeywords(JSON.parse(readFileSync(file, 'utf8')));
      } catch {
        this.#words = [];
      }
    }
  }

  get() {
    return [...this.#words];
  }

  set(list) {
    if (!this.#file) {
      return null;
    }
    this.#words = cleanKeywords(list);
    const tmp = `${this.#file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.#words), { mode: 0o600 });
    renameSync(tmp, this.#file);
    return this.get();
  }
}
