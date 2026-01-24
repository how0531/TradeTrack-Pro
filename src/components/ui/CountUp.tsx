import React, { useState, useEffect, useRef } from 'react';
import { formatCompactNumber, formatCurrency } from '../../utils/format';

interface CountUpProps {
    end: number;
    duration?: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
    preserveValue?: boolean; // If true, don't reset to 0 on change, animate from prev
}

export const CountUp: React.FC<CountUpProps> = ({ end, duration = 1000, decimals = 2, prefix = '', suffix = '', className, preserveValue = true }) => {
    const [count, setCount] = useState(preserveValue ? 0 : 0);
    const startVal = useRef(0);
    const startTime = useRef<number | null>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        startVal.current = count;
        startTime.current = null;
        
        const animate = (time: number) => {
            if (!startTime.current) startTime.current = time;
            const progress = time - startTime.current;
            const percentage = Math.min(progress / duration, 1);
            
            // Ease out quart
            const ease = 1 - Math.pow(1 - percentage, 4);
            
            const current = startVal.current + (end - startVal.current) * ease;
            setCount(current);

            if (progress < duration) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current as number);
    }, [end, duration]);

    // Formatting based on magnitude logic similar to App
    const display = React.useMemo(() => {
        // Use standard formatting logic if needed, or simple fixed
        return count.toFixed(decimals);
    }, [count, decimals]);

    return <span className={className}>{prefix}{display}{suffix}</span>;
};
