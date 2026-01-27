import React from 'react';

export const CompletedStamp = () => {
    return (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40 z-10 rotate-[-15deg]">
            <div className="border-4 border-green-600 text-green-600 font-black text-6xl px-8 py-2 rounded-lg tracking-widest uppercase shadow-sm">
                SELESAI
            </div>
        </div>
    );
};

export const SmallCompletedStamp = () => {
    return (
        <span className="ml-2 border-2 border-green-600 text-green-600 font-bold text-[10px] px-1 rounded transform rotate-[-10deg] inline-block">
            SELESAI
        </span>
    );
};
