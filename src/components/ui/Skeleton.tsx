import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'text' }) => {
    const baseClass = "animate-pulse bg-white/10 rounded";
    const variantClass = variant === 'circular' ? 'rounded-full' : 'rounded-md';
    
    return (
        <div className={`${baseClass} ${variantClass} ${className || ''}`}></div>
    );
};
