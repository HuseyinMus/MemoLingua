
import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  adSlot?: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
}

const AD_CONFIG = {
    client: process.env.ADSENSE_CLIENT_ID || "", 
    isTestMode: process.env.NODE_ENV === 'development'
};

export const AdBanner: React.FC<AdBannerProps> = ({ adSlot, format = 'auto', className = '' }) => {
    const adRef = useRef<HTMLModElement>(null);
    const hasLoaded = useRef(false);

    useEffect(() => {
        if (AD_CONFIG.isTestMode || !AD_CONFIG.client) return;

        try {
            if (hasLoaded.current) return;
            // @ts-ignore
            if (window.adsbygoogle) {
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                hasLoaded.current = true;
            }
        } catch (e) {
            console.error("AdSense push error", e);
        }
    }, []);

    if (AD_CONFIG.isTestMode) {
        return (
            <div className={`w-full bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center text-zinc-400 my-4 select-none ${className}`}>
                <span className="text-xs font-bold uppercase tracking-widest mb-1">Reklam Alanı (Test)</span>
                <p className="text-[10px] mt-2 text-center text-zinc-500 max-w-xs">
                   Environment variables ayarlanmadı.
                </p>
            </div>
        );
    }

    if (!AD_CONFIG.client) return null;

    return (
        <div className={`w-full my-4 overflow-hidden flex justify-center bg-transparent min-h-0 ${className}`}>
            <ins className="adsbygoogle"
                ref={adRef}
                style={{ display: 'block', width: '100%', background: 'transparent' }}
                data-ad-client={AD_CONFIG.client}
                data-ad-slot={adSlot}
                data-ad-format={format}
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};
