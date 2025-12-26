
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Safe environment variable access
const getEnv = (key: string, fallback: string) => {
    // @ts-ignore
    const val = (typeof import.meta !== 'undefined' && import.meta.env?.[key]) ||
        // @ts-ignore
        (typeof process !== 'undefined' && process.env?.[key]);

    return val || fallback;
};

// Check if we are in production
const isProduction = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) return true;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return true;
    return false;
};

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

export class AdService {
    private static instance: AdService;
    private initialized = false;
    private bannerShowing = false;

    private constructor() { }

    public static getInstance(): AdService {
        if (!AdService.instance) {
            AdService.instance = new AdService();
        }
        return AdService.instance;
    }

    public async initialize() {
        if (this.initialized || !Capacitor.isNativePlatform()) return;

        const bannerId = getEnv('VITE_ADMOB_BANNER_ID', TEST_BANNER_ID);
        // If it's the user's ID or production, we go real. 
        // Otherwise (localhost/test) we stay in test mode to prevent AdMob bans.
        const shouldBeReal = bannerId.startsWith('ca-app-pub-8047230624362046') || isProduction();

        try {
            await AdMob.initialize({
                // @ts-ignore
                requestTrackingAuthorization: true,
                initializeForTesting: !shouldBeReal,
            });
            this.initialized = true;
            console.log('AdMob Initialized. Real Ads:', shouldBeReal);
        } catch (error) {
            console.error('AdMob Initialization failed:', error);
        }
    }

    public async showBanner() {
        if (!Capacitor.isNativePlatform()) return;
        if (this.bannerShowing) return;

        if (!this.initialized) await this.initialize();

        const adId = getEnv('VITE_ADMOB_BANNER_ID', TEST_BANNER_ID);
        const shouldBeReal = adId.startsWith('ca-app-pub-8047230624362046') || isProduction();

        const options = {
            adId: adId,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.TOP_CENTER, // TOP is better to avoid navbar overlap
            margin: 0,
            isTesting: !shouldBeReal
        };

        try {
            await AdMob.showBanner(options);
            this.bannerShowing = true;
        } catch (error) {
            console.error('Banner show error:', error);
            // If it fails, maybe try to resume instead
            try { await AdMob.resumeBanner(); this.bannerShowing = true; } catch (e) { }
        }
    }

    public async hideBanner() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await AdMob.hideBanner();
            this.bannerShowing = false;
        } catch (error) {
            console.error('Banner hide error:', error);
        }
    }

    public async showInterstitial() {
        if (!Capacitor.isNativePlatform()) return;
        if (!this.initialized) await this.initialize();

        const adId = getEnv('VITE_ADMOB_INTERSTITIAL_ID', TEST_INTERSTITIAL_ID);
        const shouldBeReal = adId.startsWith('ca-app-pub-8047230624362046') || isProduction();

        try {
            await AdMob.prepareInterstitial({
                adId: adId,
                isTesting: !shouldBeReal
            });
            await AdMob.showInterstitial();
        } catch (error) {
            console.error('Interstitial error:', error);
        }
    }

    public async showRewarded() {
        if (!Capacitor.isNativePlatform()) return;
        if (!this.initialized) await this.initialize();

        const adId = getEnv('VITE_ADMOB_REWARDED_ID', TEST_REWARDED_ID);
        const shouldBeReal = adId.startsWith('ca-app-pub-8047230624362046') || isProduction();

        try {
            await AdMob.prepareRewardVideoAd({
                adId: adId,
                isTesting: !shouldBeReal
            });
            const rewardItem = await AdMob.showRewardVideoAd();
            return rewardItem;
        } catch (error) {
            console.error('Rewarded ad error:', error);
            return null;
        }
    }
}

export const adService = AdService.getInstance();
