import { notificationsApi } from "./api";

/** Web Push só funciona com Service Worker + PushManager (e HTTPS ou localhost). */
export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Pede permissão (sempre a partir de um clique do usuário — permissão contextual)
 * e registra a inscrição no servidor.
 */
export async function enablePush(vapidPublicKey: string): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource }));
  await notificationsApi.subscribePush(sub.toJSON());
  return "granted";
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await notificationsApi.unsubscribePush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
