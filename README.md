# CueTasks Documentation

**CueTasks** — _Say it. Cue it. Get it done._

CueTasks is a progressive web app (PWA) designed to provide a seamless, voice-powered task management experience. It features local-first storage, robust notifications, recurring task management, and an intelligent task history view.

---

## 🚀 Key Functionality

- **Voice-Powered Entry**: Create tasks using speech recognition via the Web Speech API. The system parses spoken dates and titles automatically.
- **Categorization System**: Users can create custom categories, assign specific colors, and choose emoji icons to visually organize tasks.
- **Notifications & Reminders**: A multi-layered reminder system ensuring users never miss a task:
  - Browser Push Notifications (via Service Worker)
  - In-App Toast Notifications
  - Custom Audio Alerts (using the Web Audio API)
  - Device Vibration
- **Recurring Tasks**: Comprehensive repeating task support:
  - Presets (Daily, Weekdays, Weekly, Monthly)
  - Custom intervals (e.g., Every 3 weeks)
  - End conditions (Never, on a specific date, after X occurrences)
- **Task History & Stats**: A dedicated dashboard for reviewing past productivity:
  - Search and filter by status, category, and date ranges (7/30/90 days).
  - Productivity statistics (Completion rate, total tasks done, best performing day).
  - Chronological grouping of completed tasks.
- **Modern UI/UX**: Responsive, mobile-first grid layout featuring dark/light mode, glassmorphism, and smooth micro-animations.
- **Offline Capable (PWA)**: Stores tasks and categories via `localStorage` and utilizes a service worker for offline support and background reminder checking.

---

## 🔧 Remaining Parts Needing Fixing

While the core web app is fully functional, there are a few edge cases and deferred fixes:

1. **iOS PWA Limitations**: 
   - iOS Safari restricts continuous voice listening in the background.
   - Push notifications via service workers on iOS can be unreliable depending on the iOS version and whether the app is added to the home screen.
2. **Recurring Task Bulk Editing**: 
   - Currently, completing a recurring task automatically spawns the next occurrence. However, a bulk "Edit this and all future occurrences" dialog is deferred and not fully implemented yet.
3. **Background Sync**: 
   - Service worker termination by the browser can occasionally cause delayed background push notifications if the in-app `reminderChecker` is inactive (i.e., the app tab is closed).

---

## 🔮 Future Enhancements

1. **Native Cross-Platform Conversion**: 
   - Integrate **Capacitor** to wrap the application for native iOS (App Store) and Android (Google Play) distribution. 
   - This will resolve iOS web notification issues by replacing web APIs with native notification, haptic, and speech recognition plugins.
2. **Cloud Synchronization**: 
   - Transition from purely `localStorage` to a backend database (e.g., Firebase, Supabase) to allow users to sync tasks across multiple devices.
3. **Subtasks and Attachments**: 
   - Allow users to break down complex tasks into smaller subtasks and attach relevant images or links.
4. **Calendar Integrations**: 
   - Two-way sync with Google Calendar and Apple Calendar so scheduled tasks appear alongside daily events.

---

## 📁 File Structure

```text
CueTasks/
├── public/
│   └── sw.js                     # Service worker for offline capability & background tasks
├── src/
│   ├── components/
│   │   ├── CategoryManager.tsx   # Modal for creating/editing custom categories
│   │   ├── DailySummary.tsx      # Dashboard showing daily completion progress
│   │   ├── Logo.tsx              # CueTasks brand mark (SVG, gradient)
│   │   ├── TaskForm.tsx          # Form for adding tasks (voice, date, recurrence)
│   │   ├── TaskHistory.tsx       # Modal showing historical tasks and stats
│   │   ├── TaskItem.tsx          # Individual task component with actions
│   │   ├── TaskList.tsx          # Renders lists of tasks with sorting/filtering
│   │   └── ToastNotification.tsx # In-app alerts for reminders
│   ├── contexts/
│   │   └── TaskContext.tsx       # Global state management for tasks and categories
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces (Task, Category, RecurrencePattern)
│   ├── utils/
│   │   ├── audio.ts              # Web Audio API notification sounds
│   │   ├── dateUtils.ts          # Helper functions for date formatting
│   │   ├── recurrence.ts         # Logic for calculating next occurrences of recurring tasks
│   │   ├── reminderChecker.ts    # Polling hook for triggering due reminders in-app
│   │   └── speechRecognition.ts  # Web Speech API wrapper for voice input
│   ├── App.tsx                   # Main application layout and component orchestration
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Global styles and Tailwind configuration
```
