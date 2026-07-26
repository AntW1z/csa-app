// Mirrors src/notifications.ts's sendPushToTokens on the client, minus the
// token-cleanup wiring — that lives on the client because it's the far
// more frequent send path (moderator-triggered), and Expo only reveals a
// dead token via an actual send's response either way.
export async function sendExpoPush(tokens: string[], title: string, body: string) {
  const unique = Array.from(new Set(tokens)).filter((t) => t?.startsWith('ExponentPushToken'));
  if (unique.length === 0) return 0;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));

  await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((to) => ({ to, title, body }))),
      });
      const json = await res.json();
      console.log('Expo push response:', JSON.stringify(json));
    })
  );

  return unique.length;
}
