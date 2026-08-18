import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { sendExpoPush } from './pushHelpers';

if (!getApps().length) initializeApp();

// Ignore anything older than this — without it, the very first run after
// deploying this feature would treat every past event ever created as
// "not yet notified" and blast a backlog of stale pushes.
const BACKFILL_GUARD_MS = 24 * 60 * 60 * 1000;

interface PostDoc {
  title: string;
  dateTime?: string;
  allDay?: boolean;
  visibility: 'everyone' | 'members';
  remindBeforeEnabled?: boolean;
  remindBeforeMinutes?: number;
  startNotificationSent?: boolean;
  reminderSent?: boolean;
}

interface UserDoc {
  uid: string;
  role: string;
  pushToken?: string;
  notificationsEnabled?: boolean;
}

async function notifyForPost(
  db: FirebaseFirestore.Firestore,
  users: UserDoc[],
  post: PostDoc,
  title: string,
  body: string
) {
  const tokens = users
    .filter((u) => u.pushToken && u.notificationsEnabled !== false && (post.visibility === 'everyone' || u.role !== 'user'))
    .map((u) => u.pushToken as string);
  const reached = await sendExpoPush(tokens, title, body);
  console.log(`"${title}" reached ${reached} device(s).`);

  // Written into the same collection the app's in-app inbox and Manage >
  // Notifications > Sent already read from, so these show up right
  // alongside moderator-sent messages with no client changes needed.
  await db.collection('notifications').add({
    title,
    body,
    audience: post.visibility,
    status: 'sent',
    sentAt: FieldValue.serverTimestamp(),
    createdBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection('logs').add({
    message: `Automatically sent "${title}" (${reached} device${reached === 1 ? '' : 's'})`,
    actorName: 'Automatic reminder',
    actorUid: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Every non-all-day event gets a "starting now" push the moment it begins,
// unconditionally. A moderator can additionally opt into one early
// reminder per event (remindBeforeEnabled + remindBeforeMinutes, 0-60,
// set in the post form) that fires "starting in N mins" ahead of time.
// Both are guarded by their own *Sent flag so each only ever fires once.
export const sendEventReminders = onSchedule('every 15 minutes', async () => {
  const db = getFirestore();
  const now = Date.now();
  const cutoffIso = new Date(now - BACKFILL_GUARD_MS).toISOString();

  const postsSnap = await db.collection('posts').where('dateTime', '>', cutoffIso).get();
  const candidates = postsSnap.docs.filter((d) => {
    const p = d.data() as PostDoc;
    return !!p.dateTime && !p.allDay;
  });

  if (candidates.length === 0) {
    console.log('No candidate events this run.');
    return;
  }

  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map((d) => d.data() as UserDoc);

  for (const postDoc of candidates) {
    const post = postDoc.data() as PostDoc;
    const start = new Date(post.dateTime!).getTime();

    if (!post.startNotificationSent && start <= now) {
      await notifyForPost(db, users, post, 'Starting now', `${post.title} is starting now!`);
      await postDoc.ref.update({ startNotificationSent: true });
    }

    if (post.remindBeforeEnabled && post.remindBeforeMinutes != null && !post.reminderSent) {
      const fireAt = start - post.remindBeforeMinutes * 60000;
      if (fireAt <= now) {
        const mins = post.remindBeforeMinutes;
        await notifyForPost(db, users, post, 'Starting soon', `${post.title} is starting in ${mins} min${mins === 1 ? '' : 's'}`);
        await postDoc.ref.update({ reminderSent: true });
      }
    }
  }
});
