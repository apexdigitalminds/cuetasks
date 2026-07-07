interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Web Speech API is non-standard and not in the DOM lib typings.
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

type SpeechRecognitionCallback = (text: string) => void;

class SpeechRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public toggleListening(callback: SpeechRecognitionCallback): boolean {
    if (!this.recognition) return false;

    if (this.isListening) {
      this.stop();
      return false;
    } else {
      this.start(callback);
      return true;
    }
  }

  private start(callback: SpeechRecognitionCallback): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.resultIndex][0].transcript;
      callback(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    this.recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error', event.error);
      this.isListening = false;
    };

    this.recognition.start();
    this.isListening = true;
  }

  private stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}

export const speechRecognition = new SpeechRecognitionService();

export const parseSpeechToTask = (speech: string): { title: string; dateTime: string | null } => {
  // Try to extract date and time information from the speech
  const dateTimeRegex = /\b(today|tomorrow|next week|on\s+\w+|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\/\d{1,2}|\w+\s+\d{1,2}(st|nd|rd|th)?)\b.*?\b(at|by)\b.*?\b(\d{1,2}(:\d{2})?\s*(am|pm))\b/i;
  const match = speech.match(dateTimeRegex);
  
  let dateTime: string | null = null;
  let title = speech.trim();
  
  if (match) {
    const datePart = match[1].toLowerCase();
    const timePart = match[4].toLowerCase();
    
    // Parse date
    const date = new Date();
    if (datePart === 'today') {
      // already set to today
    } else if (datePart === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (datePart.includes('next week')) {
      date.setDate(date.getDate() + 7);
    } else {
      // For now, default to today if we can't parse the date
      // A more sophisticated implementation would parse various date formats
    }
    
    // Parse time
    const timeMatch = timePart.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].substring(1)) : 0;
      const ampm = timeMatch[3].toLowerCase();
      
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      date.setHours(hours, minutes, 0, 0);
    }
    
    dateTime = date.toISOString();
    
    // Remove the date/time part from the title
    title = speech.replace(match[0], '').trim();
  }
  
  return { title, dateTime };
};