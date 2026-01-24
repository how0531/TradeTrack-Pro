type HapticPattern = 'success' | 'warning' | 'error' | 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy';

const patterns: Record<HapticPattern, number | number[]> = {
    success: [50, 50, 50], // Light double tap
    warning: [50, 100, 50], // Alert sequence
    error: [50, 50, 50, 50, 100], // Longer sequence
    selection: 10,  // Very light tick
    impactLight: 20,
    impactMedium: 40,
    impactHeavy: [60]
};

export const vibrate = (pattern: HapticPattern | number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            const sequence = typeof pattern === 'string' ? patterns[pattern] : pattern;
            navigator.vibrate(sequence);
        } catch (e) {
            // Ignore errors if vibration is blocked or unsupported
        }
    }
};
