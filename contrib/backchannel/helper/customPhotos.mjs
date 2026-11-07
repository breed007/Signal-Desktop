// Copyright 2026 Mike Simone
// SPDX-License-Identifier: AGPL-3.0-only

// Your own photo for anyone (decision F44), as Backchannel Android's
// "Contact photo": a picture you pick for a person always beats their
// profile photo and your phone's. Signal has no such field, so the helper
// keeps the pictures in its config folder and serves them in place of
// Signal's.

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export const MAX_CUSTOM_PHOTO_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class CustomPhotos {
  #dir;
  #index = {};

  constructor(dir) {
    this.#dir = dir;
    const file = dir && join(dir, 'index.json');
    if (file && existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          this.#index = parsed;
        }
      } catch {
        this.#index = {};
      }
    }
  }

  // conversationId -> version, for the page.
  versions() {
    return Object.fromEntries(
      Object.entries(this.#index).map(([id, entry]) => [id, entry.version])
    );
  }

  get(conversationId) {
    const entry = this.#index[conversationId];
    if (!entry || !this.#dir) {
      return null;
    }
    try {
      return {
        version: entry.version,
        contentType: entry.contentType,
        bytes: readFileSync(join(this.#dir, fileName(conversationId))),
      };
    } catch {
      return null;
    }
  }

  set(conversationId, contentType, bytes, now = Date.now()) {
    if (
      !this.#dir ||
      typeof conversationId !== 'string' ||
      conversationId.length === 0 ||
      conversationId.length > 128 ||
      !TYPES.has(contentType) ||
      bytes.length === 0 ||
      bytes.length > MAX_CUSTOM_PHOTO_BYTES
    ) {
      return false;
    }
    mkdirSync(this.#dir, { recursive: true, mode: 0o700 });
    const path = join(this.#dir, fileName(conversationId));
    writeFileSync(`${path}.tmp`, bytes, { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
    this.#index[conversationId] = { version: String(now), contentType };
    this.#save();
    return true;
  }

  remove(conversationId) {
    if (!this.#index[conversationId]) {
      return false;
    }
    delete this.#index[conversationId];
    rmSync(join(this.#dir, fileName(conversationId)), { force: true });
    this.#save();
    return true;
  }

  #save() {
    const file = join(this.#dir, 'index.json');
    writeFileSync(`${file}.tmp`, JSON.stringify(this.#index), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
  }
}

function fileName(conversationId) {
  return createHash('sha256').update(conversationId).digest('hex');
}
