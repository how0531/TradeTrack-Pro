import { useState, useEffect } from 'react';

/**
 * useCountUp hook
 * A simple hook to animate a numeric value from its current state to a target state.
 */
export const useCountUp = (endValue: number, duration: number = 500, deps: any[] = []) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const startValue = count;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            setCount(startValue + easeProgress * (endValue - startValue));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [endValue, ...deps]);

    return count;
};
