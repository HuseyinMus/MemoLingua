
import React from 'react';

export const Shimmer = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-2xl ${className}`}></div>
);
