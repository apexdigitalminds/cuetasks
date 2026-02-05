import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker for persistent notifications
if ('serviceWorker' in navigator && 
    !window.location.hostname.includes('webcontainer') && 
    !window.location.hostname.includes('stackblitz')) {
  window.addEventListener('load', () => {
    console.log('Registering service worker...');
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Wait for service worker to be ready
        return navigator.serviceWorker.ready;
      })
      .then((registration) => {
        console.log('Service worker ready:', registration);
        
        // Request notification permission immediately
        if ('Notification' in window) {
          console.log('Current notification permission:', Notification.permission);
          
          if (Notification.permission === 'default') {
            setTimeout(() => {
              Notification.requestPermission().then((permission) => {
              console.log('Notification permission result:', permission);
              
              if (permission === 'granted') {
                // Send test notification to verify system works
                if (navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'REQUEST_PERMISSION'
                  });
                }
              }
              });
            }, 1000); // Delay permission request to avoid blocking app load
          } else if (Notification.permission === 'granted') {
            console.log('Notification permission already granted');
            // Test the notification system
            setTimeout(() => {
              if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'REQUEST_PERMISSION'
              });
              }
            }, 1000);
          }
        }
        
        // Check for background sync support
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          console.log('Background sync supported');
        } else {
          console.log('Background sync not supported, using fallback methods');
        }
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Message from service worker:', event.data);
          
          if (event.data && event.data.type === 'COMPLETE_TASK') {
            // Dispatch custom event to complete task
            window.dispatchEvent(new CustomEvent('completeTaskFromNotification', {
              detail: { taskId: event.data.taskId }
            }));
          } else if (event.data && event.data.type === 'NOTIFICATION_SHOWN') {
            console.log('Notification shown for task:', event.data.taskTitle);
          }
        });
        
        // Keep service worker active with more frequent pings
        setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE' });
          }
        }, 15000); // Send keep-alive every 15 seconds
        
      })
      .catch((registrationError) => {
        console.warn('SW registration failed: ', registrationError);
        // Don't let service worker errors block app loading
      });
  });
  
  // Handle page visibility changes to maintain service worker
  document.addEventListener('visibilitychange', () => {
    console.log('Page visibility changed:', document.visibilityState);
    if (document.visibilityState === 'visible' && navigator.serviceWorker.controller) {
      // Sync when app becomes visible
      navigator.serviceWorker.controller.postMessage({ type: 'SYNC_ON_FOCUS' });
      // Also trigger a reminder check
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_REMINDERS_NOW' });
    }
  });
  
  // Handle page beforeunload to ensure service worker stays active
  window.addEventListener('beforeunload', () => {
    console.log('Page unloading, service worker should continue running');
  });
  
  // Add focus event to check reminders when app regains focus
  window.addEventListener('focus', () => {
    console.log('App focused, checking reminders');
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_REMINDERS_NOW' });
    }
  });
} else {
  console.log('Service Workers not supported in this environment (WebContainer/StackBlitz)');
}

// Ensure DOM is ready before rendering
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);