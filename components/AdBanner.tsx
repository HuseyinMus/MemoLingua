
import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  adSlot?: string; // Google AdSense slot ID (AdSense panelinden aldığın Slot ID)
  format?: 'auto' | 'fluid' | 'rectangle';
  className?: string;
}

// REKLAM KONFİGÜRASYONU
// Burayı AdSense panelinden aldığın bilgilerle doldurmalısın.
const AD_CONFIG = {
    // BURAYI DEĞİŞTİR: Kendi Yayıncı Kimliğin (Publisher ID)
    // Örnek: ca-pub-1234567890123456
    client: "ca-pub-XXXXXXXXXXXXXXXX", 
    
    // Uygulamanı yayına aldıktan ve AdSense onayı aldıktan sonra bunu 'false' yap.
    isTestMode: true 
};

export const AdBanner: React.FC<AdBannerProps> = ({ adSlot, format = 'auto', className = '' }) => {
    const adRef = useRef<HTMLModElement>(null);
    const hasLoaded = useRef(false);

    useEffect(() => {
        // Eğer Test modundaysak veya script yüklenmediyse çalıştırma
        if (AD_CONFIG.isTestMode) return;

        try {
            // Reklam zaten yüklendiyse tekrar yükleme (Strict Mode koruması)
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
                <span className="text-xs font-bold uppercase tracking-widest mb-1">Reklam Alanı (Test Modu)</span>
                <span className="text-[10px] opacity-70">Client: {AD_CONFIG.client}</span>
                <span className="text-[10px] opacity-70">Slot: {adSlot || 'Tanımlanmadı'}</span>
                <p className="text-[10px] mt-2 text-center text-zinc-500 max-w-xs">
                    Gerçek reklamları görmek için siteyi yayına al ve <code>AdBanner.tsx</code> içindeki <code>isTestMode</code> değerini <code>false</code> yap.
                </p>
            </div>
        );
    }

    return (
        <div className={`w-full my-4 overflow-hidden flex justify-center bg-transparent ${className}`}>
            <ins className="adsbygoogle"
                ref={adRef}
                style={{ display: 'block', width: '100%' }}
                data-ad-client={AD_CONFIG.client}
                data-ad-slot={adSlot}
                data-ad-format={format}
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};