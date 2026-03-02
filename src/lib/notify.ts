export async function notifyRedKPI(kpiName: string, value: number, target: number, period: string) {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (!webhookUrl) return; // skip if not configured

  const message = `🔴 KPI Alert: "${kpiName}" nilai ${value} di bawah target ${target} pada periode ${period}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch {
    // silently fail — notification is best-effort
  }
}
