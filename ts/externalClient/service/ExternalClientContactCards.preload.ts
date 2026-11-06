// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { getRegionCode } from '../../state/selectors/user.std.ts';
import { enqueueSharedContactForSend } from '../../util/enqueueSharedContactForSend.preload.ts';
import {
  applyShareContactSelection,
  canShareContact,
  getShareContactDraft,
  withE164AsMissingName,
} from '../../util/shareContact.std.ts';
import type { ServiceResultType } from '../hostTypes.std.ts';
import type { MessagesSendContactParamsType } from '../protocol.std.ts';
import { ErrorCode } from '../protocol.std.ts';
import { getSendBlockReason } from './ExternalClientSend.preload.ts';
import { getListedConversation } from './serviceHelpers.preload.ts';

// Fork addition (decision F41): Signal 8.34's Share contact, the card its
// dialog makes (getShareContactDraft), sent the way its composer sends it
// (composer shareContact).

const log = createLogger('ExternalClientContactCards');

export async function sendContact({
  conversationId,
  contactConversationId,
  phone = true,
  nickname = false,
  note = false,
}: MessagesSendContactParamsType): Promise<ServiceResultType> {
  const model = getListedConversation(conversationId);
  const person = window.ConversationController.get(contactConversationId);
  if (!model || !person || person.get('type') !== 'private') {
    return { ok: false, code: ErrorCode.NotFound };
  }
  const draft = withE164AsMissingName(
    // Contact photos first, as everywhere in this fork (decision F37).
    getShareContactDraft(person.attributes, { preferContactAvatars: true }),
    getRegionCode(window.reduxStore.getState())
  );
  const contact = applyShareContactSelection(draft, {
    e164: phone && draft.e164 != null,
    nickname,
    note,
  });
  if (!canShareContact(contact)) {
    return { ok: false, code: ErrorCode.InvalidArgument };
  }
  const reason = await getSendBlockReason(model, '');
  if (reason) {
    log.info(`sendContact: refused (${reason})`);
    return { ok: false, code: ErrorCode.PreconditionFailed, reason };
  }
  await enqueueSharedContactForSend(model, contact);
  return { ok: true, value: {} };
}
