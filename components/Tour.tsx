
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Check, ChevronRight } from 'lucide-react';

export interface TourStep {
    targetId: string;
    title: string;
    description: string;
    position?: 'top' | 'bottom'; // Optional override, otherwise auto-calculated
}

interface TourProps {
    steps: TourStep[];
    onComplete: () => void;
    onSkip: () => void;
}

export const Tour: React.FC<TourProps> = ({ steps, onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [layout, setLayout] = useState<{
        targetRect: DOMRect;
        modalPosition: 'top' | 'bottom';
    } | null>(null);

    const step = steps[currentStep];
    const modalRef = useRef<HTMLDivElement>(null);

    // 1. SCROLL LOCK & CLEANUP
    useEffect(() => {
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        
        return () => {
            // Restore scroll
            document.body.style.overflow = '';
        };
    }, []);

    // 2. POSITION CALCULATION & HIGHLIGHTING
    useEffect(() => {
        let targetElement: HTMLElement | null = null;
        let originalZIndex = '';
        let originalPosition = '';
        let originalTransition = '';

        const updateLayout = () => {
            const element = document.getElementById(step.targetId);
            if (element) {
                targetElement = element;
                
                // Scroll into view nicely
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                
                // Logic: If element is below the middle of the screen, put modal on TOP. Otherwise BOTTOM.
                const isBottomHalf = rect.top > (viewportHeight / 2);
                const modalPos = isBottomHalf ? 'top' : 'bottom';

                setLayout({
                    targetRect: rect,
                    modalPosition: modalPos
                });

                // --- SPOTLIGHT EFFECT ---
                originalZIndex = element.style.zIndex;
                originalPosition = element.style.position;
                originalTransition = element.style.transition;

                const computedStyle = window.getComputedStyle(element);
                if (computedStyle.position === 'static') {
                    element.style.position = 'relative';
                }
                
                element.style.zIndex = '61'; // Above the backdrop (z-60)
                element.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
                element.style.transform = 'scale(1.02)'; // Slight pop effect
                element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)'; // Glow
            }
        };

        // Small delay to ensure rendering allows finding the ID
        const timer = setTimeout(updateLayout, 300);
        window.addEventListener('resize', updateLayout);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateLayout);
            
            // CLEANUP
            if (targetElement) {
                targetElement.style.zIndex = originalZIndex;
                targetElement.style.position = originalPosition;
                targetElement.style.transition = originalTransition;
                targetElement.style.transform = '';
                targetElement.style.boxShadow = '';
            }
        };
    }, [currentStep, step.targetId]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    // If layout isn't ready yet, don't render the modal to prevent jumping
    if (!layout) return null;

    return (
        <div className="fixed inset-0 z-[60] touch-none font-sans">
            {/* 1. BACKDROP */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px] transition-opacity duration-500 animate-fade-in"></div>

            {/* 2. HIGHLIGHT HELPER (Optional: Invisible click blocker around the target) */}
            {/* The actual target is elevated via z-index in useEffect */}

            {/* 3. MODAL */}
            <div 
                ref={modalRef}
                className={`absolute left-0 right-0 px-6 flex justify-center pointer-events-none transition-all duration-500 ease-in-out ${
                    layout.modalPosition === 'top' 
                        ? 'bottom-[55%] pb-4 items-end' 
                        : 'top-[55%] pt-4 items-start'
                }`}
                style={{
                    // Dynamic override if using exact coordinates is preferred, 
                    // but simple top/bottom split works best for responsive mobile tours
                    top: layout.modalPosition === 'bottom' ? layout.targetRect.bottom + 20 : undefined,
                    bottom: layout.modalPosition === 'top' ? (window.innerHeight - layout.targetRect.top) + 20 : undefined
                }}
            >
                <div className="pointer-events-auto bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-2xl max-w-sm w-full animate-slide-up border border-zinc-200 dark:border-zinc-800 relative z-[70]">
                    
                    {/* Visual Connector Arrow */}
                    <div 
                        className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-zinc-900 border-l border-t border-zinc-200 dark:border-zinc-800 transform rotate-45 ${
                            layout.modalPosition === 'top' 
                                ? '-bottom-2.5 border-t-0 border-l-0 border-b border-r' // Point Down
                                : '-top-2.5' // Point Up
                        }`}
                    ></div>

                    {/* Progress Bar */}
                    <div className="absolute top-0 left-8 right-8 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-300" 
                            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-start mb-2 mt-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1 block">
                                Tur • {currentStep + 1} / {steps.length}
                            </span>
                            <h3 className="text-xl font-bold text-black dark:text-white leading-tight">{step.title}</h3>
                        </div>
                        <button onClick={onSkip} className="p-2 -mr-2 text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-300 mb-6 text-sm leading-relaxed font-medium">
                        {step.description}
                    </p>
                    
                    <button 
                        onClick={handleNext}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {currentStep === steps.length - 1 ? 'Tamamla' : 'Devam Et'} 
                        {currentStep === steps.length - 1 ? <Check size={16} /> : <ChevronRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
