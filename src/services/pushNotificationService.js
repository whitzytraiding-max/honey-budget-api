/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */

/**
 * Sends a push notification via FCM Legacy HTTP API.
 * Requires FCM_SERVER_KEY env var — get it from Firebase Console → Project Settings → Cloud Messaging.
 * If FCM_SERVER_KEY is not set, this is a no-op (no error thrown).
 */
async function sendFcmPush({ token, title, body, data = {} }) {
  const serverKey = process.env.FCM_SERVER_KEY?.trim();
  if (!serverKey || !token) {
    return null;
  }

  try {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
        data,
        priority: "high",
      }),
    });

    if (!response.ok) {
      console.warn(`FCM push failed for token ${token.slice(0, 12)}…: HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("FCM push error:", error?.message ?? error);
    return null;
  }
}

/**
 * Sends a push notification to all enabled devices for a user.
 */
async function sendPushToUser({ budgetRepository, userId, title, body, data = {} }) {
  if (!process.env.FCM_SERVER_KEY?.trim()) {
    return;
  }

  const devices = await budgetRepository.listPushDevicesForUser(userId);
  const enabledDevices = devices.filter((d) => d.enabled && d.token);

  await Promise.allSettled(
    enabledDevices.map((device) => sendFcmPush({ token: device.token, title, body, data })),
  );
}

export { sendPushToUser };
