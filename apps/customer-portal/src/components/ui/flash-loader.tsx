'use client';

import React from 'react';

/**
 * FlashLoader
 * A simple, consistent loader used across the application.
 */
const FlashLoader = () => {
    return (
        <div className="flex items-center justify-center min-h-[60vh] w-full">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            </div>
        </div>
    );
};

export default FlashLoader;
