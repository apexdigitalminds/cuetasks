// Enhanced service worker for persistent mobile notifications
const CACHE_NAME = 'taskvoice-v3';
const DB_NAME = 'TaskVoiceDB';
const DB_VERSION = 3;

let db = null;

// Install and activate service worker
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(
    (async () => {
      await Promise.all([
        self.clients.claim(),
        initializeDatabase()
      ]);
      await setupPeriodicChecks();
    })()
  );
});

// Initialize IndexedDB for persistent storage
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      console.log('Upgrading database...');
      
      // Create reminders store
      if (!db.objectStoreNames.contains('reminders')) {
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'taskId' });
        reminderStore.createIndex('reminderTime', 'reminderTime', { unique: false });
        reminderStore.createIndex('dueTime', 'dueTime', { unique: false });
        console.log('Created reminders store');
      }
      
      // Create tasks store for offline access
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('dateTime', 'dateTime', { unique: false });
        console.log('Created tasks store');
      }
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('Database initialized successfully');
      resolve(db);
    };
    
    request.onerror = () => {
      console.error('Database initialization failed:', request.error);
      reject(request.error);
    };
  });
}

// Get database connection
async function getDB() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

// Handle messages from the client
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log('Service worker received message:', type, data);
  
  switch (type) {
    case 'SCHEDULE_REMINDER':
      await scheduleReminder(data);
      break;
    case 'CANCEL_REMINDER':
      await cancelReminder(data.taskId);
      break;
    case 'SYNC_TASKS':
      await syncTasks(data.tasks);
      break;
    case 'CHECK_REMINDERS_NOW':
      await checkPendingReminders();
      break;
    case 'REQUEST_PERMISSION':
      await requestNotificationPermission();
      break;
    case 'TEST_NOTIFICATION':
      await showTestNotification();
      break;
  }
});

// Request notification permission
async function requestNotificationPermission() {
  try {
    const permission = await self.registration.showNotification('TaskVoice', {
      body: 'Notifications are now enabled!',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'permission-test',
      requireInteraction: false,
      silent: false
    });
    console.log('Permission notification shown');
  } catch (error) {
    console.error('Error requesting permission:', error);
  }
}

// Show test notification
async function showTestNotification() {
  try {
    await self.registration.showNotification('TaskVoice Test', {
      body: 'This is a test notification to verify the system is working.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'test-notification',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      actions: [
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
    console.log('Test notification shown');
  } catch (error) {
    console.error('Error showing test notification:', error);
  }
}

// Schedule a reminder in IndexedDB
async function scheduleReminder(reminderData) {
  try {
    const database = await getDB();
    const transaction = database.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    
    const reminder = {
      taskId: reminderData.taskId,
      taskTitle: reminderData.taskTitle,
      reminderTime: reminderData.reminderTime,
      dueTime: reminderData.dueTime,
      minutesBefore: reminderData.minutesBefore,
      scheduled: true,
      createdAt: Date.now()
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(reminder);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('Reminder scheduled in service worker:', reminder);
    
    // Immediate check if reminder is due soon
    const timeUntilReminder = reminderData.reminderTime - Date.now();
    console.log('Time until reminder (minutes):', Math.round(timeUntilReminder / 60000));
    
    if (timeUntilReminder <= 60000 && timeUntilReminder > 0) { // Within 1 minute
      console.log('Scheduling immediate reminder check');
      setTimeout(() => checkSpecificReminder(reminderData.taskId), timeUntilReminder);
    }
    
  } catch (error) {
    console.error('Error scheduling reminder:', error);
  }
}

// Cancel a scheduled reminder
async function cancelReminder(taskId) {
  try {
    const database = await getDB();
    const transaction = database.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    
    await new Promise((resolve, reject) => {
      const request = store.delete(taskId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('Reminder cancelled:', taskId);
  } catch (error) {
    console.error('Error cancelling reminder:', error);
  }
}

// Sync tasks from the client
async function syncTasks(tasks) {
  try {
    const database = await getDB();
    const transaction = database.transaction(['tasks'], 'readwrite');
    const store = transaction.objectStore('tasks');
    
    // Clear existing tasks
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Add new tasks
    for (const task of tasks) {
      await new Promise((resolve, reject) => {
        const request = store.put(task);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    console.log('Tasks synced to service worker:', tasks.length);
  } catch (error) {
    console.error('Error syncing tasks:', error);
  }
}

// Set up periodic checks for reminders
async function setupPeriodicChecks() {
  console.log('Setting up periodic reminder checks...');
  
  // Use setInterval as primary method (works on all browsers)
  setInterval(async () => {
    console.log('Periodic reminder check triggered');
    await checkPendingReminders();
  }, 30000); // Check every 30 seconds for better reliability
  
  // Also try to register background sync if available
  try {
    if ('sync' in self.registration) {
      await self.registration.sync.register('check-reminders');
      console.log('Background sync registered');
    }
  } catch (error) {
    console.log('Background sync not available:', error);
  }
}

// Handle background sync events
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkPendingReminders());
  }
});

// Check for pending reminders
async function checkPendingReminders() {
  try {
    const database = await getDB();
    const transaction = database.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    
    const reminders = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const now = Date.now();
    console.log(`Checking ${reminders.length} reminders at ${new Date(now).toLocaleTimeString()}`);
    
    for (const reminder of reminders) {
      const timeUntilReminder = reminder.reminderTime - now;
      const timeUntilDue = reminder.dueTime - now;
      
      console.log(`Reminder ${reminder.taskId}: ${Math.round(timeUntilReminder / 60000)} min until reminder, ${Math.round(timeUntilDue / 60000)} min until due`);
      
      // Show notification if reminder time has passed but task isn't due yet
      if (timeUntilReminder <= 0 && timeUntilDue > 0) {
        console.log('Showing reminder notification for:', reminder.taskTitle);
        await showReminderNotification(reminder);
        await removeReminder(reminder.taskId);
      }
      // Clean up old reminders for overdue tasks
      else if (timeUntilDue <= -3600000) { // 1 hour past due
        console.log('Cleaning up old reminder:', reminder.taskId);
        await removeReminder(reminder.taskId);
      }
    }
  } catch (error) {
    console.error('Error checking pending reminders:', error);
  }
}

// Check a specific reminder
async function checkSpecificReminder(taskId) {
  try {
    const database = await getDB();
    const transaction = database.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    
    const reminder = await new Promise((resolve, reject) => {
      const request = store.get(taskId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (reminder) {
      const now = Date.now();
      const timeUntilReminder = reminder.reminderTime - now;
      const timeUntilDue = reminder.dueTime - now;
      
      if (timeUntilReminder <= 0 && timeUntilDue > 0) {
        console.log('Showing specific reminder notification for:', reminder.taskTitle);
        await showReminderNotification(reminder);
        await removeReminder(taskId);
      }
    }
  } catch (error) {
    console.error('Error checking specific reminder:', error);
  }
}

// Show reminder notification with mobile optimization
async function showReminderNotification(reminder) {
  const dueDate = new Date(reminder.dueTime);
  const formattedDateTime = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(dueDate);

  // Strong vibration pattern for mobile
  const vibrationPattern = [500, 200, 500, 200, 500, 200, 800];

  const options = {
    body: `Due: ${formattedDateTime}`,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `reminder-${reminder.taskId}`,
    requireInteraction: true,
    vibrate: vibrationPattern,
    silent: false,
    renotify: true,
    timestamp: Date.now(),
    actions: [
      { action: 'view', title: 'View Task' },
      { action: 'complete', title: 'Mark Complete' },
      { action: 'snooze', title: 'Snooze 5min' }
    ],
    data: {
      taskId: reminder.taskId,
      url: '/',
      taskTitle: reminder.taskTitle,
      dueTime: formattedDateTime,
      reminderTime: reminder.reminderTime
    }
  };

  try {
    await self.registration.showNotification(reminder.taskTitle, options);
    console.log('Notification shown successfully for:', reminder.taskTitle);
    
    // Send message to any open clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_SHOWN',
        taskId: reminder.taskId,
        taskTitle: reminder.taskTitle
      });
    });
    
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Remove a reminder from storage
async function removeReminder(taskId) {
  try {
    const database = await getDB();
    const transaction = database.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    
    await new Promise((resolve, reject) => {
      const request = store.delete(taskId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('Reminder removed:', taskId);
  } catch (error) {
    console.error('Error removing reminder:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action, event.notification.data);
  event.notification.close();
  
  const { taskId, taskTitle, dueTime } = event.notification.data;
  
  if (event.action === 'complete') {
    // Send message to client to mark task as complete
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach(client => {
          client.postMessage({
            type: 'COMPLETE_TASK',
            taskId: taskId
          });
        });
      })
    );
  } else if (event.action === 'snooze') {
    // Schedule another notification in 5 minutes
    const snoozeTime = Date.now() + (5 * 60 * 1000);
    setTimeout(async () => {
      try {
        await self.registration.showNotification(`${taskTitle} (Snoozed)`, {
          body: `Snoozed - Due: ${dueTime}`,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: `snooze-${taskId}`,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          actions: [
            { action: 'view', title: 'View Task' },
            { action: 'complete', title: 'Mark Complete' }
          ],
          data: {
            taskId: taskId,
            taskTitle: taskTitle,
            dueTime: dueTime,
            snoozed: true
          }
        });
      } catch (error) {
        console.error('Error showing snooze notification:', error);
      }
    }, 5 * 60 * 1000);
  }
  
  // Focus or open the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Handle push events
self.addEventListener('push', (event) => {
  console.log('Push event received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [500, 200, 500, 200, 500],
      requireInteraction: true,
      data: data
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Keep service worker alive
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'KEEP_ALIVE') {
    // Respond to keep-alive ping
    event.ports[0]?.postMessage('ALIVE');
  }
});

console.log('Enhanced mobile service worker loaded with persistent notifications');