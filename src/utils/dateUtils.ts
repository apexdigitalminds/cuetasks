export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const formatDateTimeWithTimezone = (dateTime: string, timezone?: string): string => {
  if (!dateTime || dateTime.trim() === '') {
    return '';
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  const userTimezone = timezone || getUserTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: userTimezone,
    timeZoneName: 'short'
  }).format(date);
};

export const formatTimeOnlyWithTimezone = (dateTime: string, timezone?: string): string => {
  if (!dateTime || dateTime.trim() === '') {
    return '';
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  const userTimezone = timezone || getUserTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: userTimezone
  }).format(date);
};

export const getLocalDateTimeString = (date?: Date): string => {
  const now = date || new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatDateTime = (dateTime: string): string => {
  if (!dateTime || dateTime.trim() === '') {
    return '';
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
};

export const formatTimeOnly = (dateTime: string): string => {
  if (!dateTime || dateTime.trim() === '') {
    return '';
  }
  
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
};

export const getToday = (): string => {
  return formatDate(new Date());
};

export const getDayName = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
};

export const isOverdue = (dateTime: string, completed: boolean): boolean => {
  // A task is overdue if it has a due time in the past and isn't done yet.
  if (completed || !dateTime || dateTime.trim() === '') return false;

  const date = new Date(dateTime);
  if (isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
};

export const isSameDay = (date1: string, date2: string): boolean => {
  // Handle empty or invalid dates
  if (!date1 || !date2) return false;
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Check for invalid dates
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};