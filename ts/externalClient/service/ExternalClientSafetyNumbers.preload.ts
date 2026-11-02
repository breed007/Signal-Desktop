// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import type { ConversationModel } from '../../models/conversations.preload.ts';
import {
  getAllServiceIds,
  getUntrustedRecipients,
} from '../../util/blockSendUntilConversationsAreVerified.dom.ts';
import { getRecipientsByConversation } from '../../util/getRecipientsByConversation.dom.ts';
import { getConversationIdsStoppedForVerification } from '../../state/selectors/conversations.dom.ts';
import { drop } from '../../util/drop.std.ts';
import { isNotNil } from '../../util/isNotNil.std.ts';
import type { ServiceResultType } from '../hostTypes.std.ts';
import type {
  SafetyNumbersAcceptParamsType,
  SafetyNumbersChangedParamsType,
  SafetyNumbersChangedResultType,
} from '../protocol.std.ts';
import { ErrorCode } from '../protocol.std.ts';
import { getListedConversation } from './serviceHelpers.preload.ts';

// Fork addition (decision F35): Signal's "Safety number changed" dialog.
// Since decision F40 every send accepts changed safety numbers itself
// (acceptAllSafetyNumbers), so the dialog's methods are left for clients
// that still ask.

const log = createLogger('ExternalClientSafetyNumbers');

// The people whose new safety number stops a send to this chat, found as
// the composer finds them.
async function untrustedContacts(
  model: ConversationModel
): Promise<Array<ConversationModel>> {
  const untrusted = await getUntrustedRecipients(
    getRecipientsByConversation([model.attributes])
  );
  return [...getAllServiceIds(untrusted)]
    .map(serviceId => window.ConversationController.get(serviceId))
    .filter(isNotNil);
}

// Accepts them the way the dialog's "Send anyway" does
// (verifyConversationsStoppingSend).
async function accept(contacts: ReadonlyArray<ConversationModel>) {
  await Promise.all(
    contacts.flatMap(contact => [
      ...(contact.isUnverified() ? [contact.setVerifiedDefault()] : []),
      contact.setApproved(),
    ])
  );
}

// Decision F40: a send never stops on a changed safety number.
export async function acceptAllSafetyNumbers(
  model: ConversationModel
): Promise<void> {
  const contacts = await untrustedContacts(model);
  if (contacts.length === 0) {
    return;
  }
  log.info(
    `acceptAllSafetyNumbers: accepting ${contacts.length} in ${model.idForLogging()}`
  );
  await accept(contacts);
}

// A safety number that changes during a send stops that chat's queue and
// opens Signal's dialog, which nobody sees here; "Send anyway" for it
// (decision F40) so the message goes out.
let releasing = false;
export function releaseSendsStoppedForVerification(): void {
  if (
    releasing ||
    getConversationIdsStoppedForVerification(window.reduxStore.getState())
      .length === 0
  ) {
    return;
  }
  releasing = true;
  log.info('releaseSendsStoppedForVerification: accepting and resending');
  drop(
    (async () => {
      try {
        await window.reduxActions.conversations.verifyConversationsStoppingSend();
      } finally {
        releasing = false;
      }
    })()
  );
}

export async function listChangedSafetyNumbers({
  conversationId,
}: SafetyNumbersChangedParamsType): Promise<ServiceResultType> {
  const model = getListedConversation(conversationId);
  if (!model) {
    return { ok: false, code: ErrorCode.NotFound };
  }
  const value: SafetyNumbersChangedResultType = {
    contacts: (await untrustedContacts(model)).map(contact => ({
      conversationId: contact.id,
      title: contact.getTitle(),
    })),
  };
  return { ok: true, value };
}

export async function acceptSafetyNumbers({
  conversationId,
  contactIds,
}: SafetyNumbersAcceptParamsType): Promise<ServiceResultType> {
  const model = getListedConversation(conversationId);
  if (!model) {
    return { ok: false, code: ErrorCode.NotFound };
  }
  // Only people whose change stops this chat's sends right now.
  const chosen = new Set(contactIds);
  const accepting = (await untrustedContacts(model)).filter(contact =>
    chosen.has(contact.id)
  );
  log.info(
    `acceptSafetyNumbers: accepting ${accepting.length} in ${model.idForLogging()}`
  );
  await accept(accepting);
  return { ok: true, value: { accepted: accepting.length } };
}
