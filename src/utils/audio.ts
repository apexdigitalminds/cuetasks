// Audio notification utilities
let audioContext: AudioContext | null = null;

// Initialize AudioContext on user interaction
export const initAudio = (): void => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
};

// Play a notification sound using Web Audio API
export const playNotificationSound = async (): Promise<void> => {
    try {
        // Initialize on first call
        if (!audioContext) {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Resume if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Create a pleasant notification tone
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Pleasant two-tone notification sound
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.15); // G5

        oscillator.type = 'sine';

        // Volume envelope for smooth sound
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.15);
        gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.2);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);

    } catch (error) {
        console.warn('Failed to play notification sound:', error);
    }
};

// Vibrate device if supported (mobile)
export const vibrateDevice = (pattern: number[] = [200, 100, 200]): boolean => {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
        return true;
    }
    return false;
};

// Combined notification alert (sound + vibration)
export const alertUser = async (): Promise<void> => {
    await playNotificationSound();
    vibrateDevice([200, 100, 200, 100, 200]);
};
