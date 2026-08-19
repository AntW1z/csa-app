import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';

export interface PushRecipient {
  uid: string;
  token: string;
}

// Foreground behavior — without this, a notification that arrives while the
// app is open won't show a banner at all.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission and saves this device's Expo push token onto the
// signed-in user's profile doc. Moderators' clients read these tokens
// directly (see sendPushToTokens) — there's no backend, so a new post's
// notification is sent from whichever device published it.
export async function registerForPushNotificationsAsync(uid: string) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await updateDoc(doc(db, 'users', uid), { pushToken: token });
  } catch (err) {
    // Most commonly: no EAS project linked yet (run `eas init`) — not
    // fatal, the rest of the app works fine without push notifications.
    console.warn('Push notification registration failed:', err);
  }
}

export interface SendResult {
  attempted: number;
  // Human-readable failure messages from *either* stage: a ticket coming
  // back "error" immediately (bad/dead token, invalid credentials, etc.)
  // or a ticket that came back "ok" but whose receipt later reported a
  // delivery failure (checked a few seconds after sending). Both used to
  // be conflated as "attempted" with only receipt errors surfaced, which
  // meant a token that failed at the ticket stage silently counted as
  // delivered — that's the gap that made "delivered to N devices" lie.
  errors: string[];
}

// Sent directly from the publishing moderator's device via Expo's push
// service — no Cloud Functions or backend required. Expo's API caps each
// request at 100 messages, so recipient lists beyond that are chunked.
//
// Also self-heals stale tokens: Expo only reveals a token is dead
// (DeviceNotRegistered — the app was uninstalled, etc.) when you actually
// try to send to it, there's no standalone "is this valid" check. So
// rather than a separate scheduled job guessing which tokens might be
// stale, this just clears the token off that user's profile the moment a
// real send discovers it's dead.
export async function sendPushToTokens(recipients: PushRecipient[], title: string, body: string, data?: Record<string, unknown>): Promise<SendResult> {
  const tokenToUid = new Map<string, string>();
  for (const r of recipients) {
    if (r.token?.startsWith('ExponentPushToken')) tokenToUid.set(r.token, r.uid);
  }
  const tokens = Array.from(tokenToUid.keys());
  if (tokens.length === 0) return { attempted: 0, errors: [] };

  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

  const errors: string[] = [];

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk.map((to) => ({ to, title, body, data }))),
        });
        const json = await res.json();
        // Expo's push API accepts the request even when an individual
        // ticket fails (e.g. DeviceNotRegistered, invalid credentials) —
        // "sent" alone doesn't mean "delivered", so log the actual tickets.
        console.log('Expo push response:', JSON.stringify(json));
        const tickets: { status: string; id?: string; details?: { error?: string } }[] = json.data ?? [];
        const ticketErrors = tickets.filter((t) => t.status === 'error');
        if (ticketErrors.length > 0) console.warn('Push send had per-ticket errors:', JSON.stringify(ticketErrors));
        if (json.errors) console.warn('Push send request-level errors:', JSON.stringify(json.errors));
        // These come back immediately, in this same response — previously
        // only logged to the console, never surfaced to the moderator, so
        // a token that failed right here still counted toward "delivered."
        for (const t of ticketErrors) errors.push(t.details?.error ?? 'Unknown send error');

        await Promise.all(
          tickets.map((ticket, i) => {
            if (ticket.details?.error !== 'DeviceNotRegistered') return null;
            const uid = tokenToUid.get(chunk[i]);
            return uid ? updateDoc(doc(db, 'users', uid), { pushToken: deleteField() }) : null;
          })
        );

        const okTicketIds = tickets.filter((t) => t.status === 'ok' && t.id).map((t) => t.id as string);
        if (okTicketIds.length === 0) return;

        // Receipts aren't guaranteed ready instantly — Expo recommends
        // waiting, this is a short compromise so the UI can still surface
        // something useful without the moderator waiting minutes.
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: okTicketIds }),
        });
        const receiptJson = await receiptRes.json();
        console.log('Expo push receipts:', JSON.stringify(receiptJson));
        const receipts: Record<string, { status: string; message?: string; details?: { error?: string } }> = receiptJson.data ?? {};
        for (const id of Object.keys(receipts)) {
          const r = receipts[id];
          if (r.status === 'error') {
            errors.push(r.details?.error ? `${r.details.error}: ${r.message ?? ''}`.trim() : (r.message ?? 'Unknown delivery error'));
          }
        }
      } catch (err) {
        console.warn('Push send failed:', err);
      }
    })
  );

  return { attempted: tokens.length, errors };
}
