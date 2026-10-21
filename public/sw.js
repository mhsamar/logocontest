// logocontest.bd service worker: shows browser push notifications (BLUEPRINT §12).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "logocontest.bd", {
      body: data.body || "",
      icon: "/brand/apple-icon.png",
      badge: "/brand/apple-icon.png",
      data: { url: data.url || "/" },
    }),
  );
});

// A tap opens the notification's page. It may be on one of the site's other addresses (the backup address while
// logocontest.bd is down at BTCL, owner 2026-10-21); any other address opens the home page instead.
const OWN = ["https://logocontest.bd", "https://logocontestbd.com", "https://logocontest.vercel.app"];

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url;
  try {
    url = new URL(event.notification.data?.url || "/", self.location.origin);
  } catch {
    url = new URL("/", self.location.origin);
  }
  if (url.origin !== self.location.origin && !OWN.includes(url.origin)) url = new URL("/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = url.origin === self.location.origin && windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url.href).then((w) => (w || open).focus());
      return self.clients.openWindow(url.href);
    }),
  );
});
