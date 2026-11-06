// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import * as Errors from '../../types/errors.std.ts';
import { drop } from '../../util/drop.std.ts';

// Fork addition (decision F52), as Backchannel Android: a note that lands in
// Note to Self from another of your devices is read already, so Note to
// Self never shows unread. Signal counts it unread until the chat is opened
// again. A manual "Mark as unread" is left alone. No read receipts: they
// would only go to yourself.

const log = createLogger('ExternalClientNoteToSelf');

let clearing = false;

export function keepNoteToSelfRead(): void {
  if (clearing) {
    return;
  }
  const model = window.ConversationController.getOurConversation();
  if (!model || !((model.get('unreadCount') ?? 0) > 0)) {
    return;
  }
  clearing = true;
  drop(
    model
      .markRead(
        { received_at: Number.MAX_SAFE_INTEGER, sent_at: Date.now() },
        { sendReadReceipts: false }
      )
      .catch(error => {
        log.warn('markRead failed', Errors.toLogFormat(error));
      })
      .finally(() => {
        clearing = false;
      })
  );
}
