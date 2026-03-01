'use client';

import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
    /** Text shown below the spinner */
    message?: string;
    /** Full-screen centered or inline */
    fullScreen?: boolean;
}

/**
 * Unified loading spinner used across all pages.
 * Usage:  <PageLoader message="Loading dashboard..." />
 */
export default function PageLoader({ message = 'Loading...', fullScreen = true }: PageLoaderProps) {
    if (!fullScreen) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-[3px] border-muted mx-auto" />
                    <div className="w-12 h-12 rounded-full border-[3px] border-primary border-t-transparent animate-spin absolute inset-0 mx-auto" />
                </div>
                <p className="text-sm text-muted-foreground mt-4">{message}</p>
            </div>
        </div>
    );
}
