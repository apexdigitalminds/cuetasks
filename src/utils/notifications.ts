// Show an OS-level notification.
//
// Prefer the service worker's showNotification(): the `new Notification()`
// constructor throws "Illegal constructor" on Android/Chrome and is unreliable
// once the page is backgrounded. Going through the SW works on mobile and
// desktop, and displays even when the tab isn't focused.
export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {},
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  if ('serviceWorker' in navigator) {
    try {
      // navigator.serviceWorker.ready never settles if no SW takes control,
      // so don't let it hang the caller.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
      ]);
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
    } catch {
      // fall through to the constructor below
    }
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    // Mobile browsers disallow the constructor outright.
    return false;
  }
}
