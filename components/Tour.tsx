
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';

export interface TourStep {
    targetId: string;
    title: string;
    description: string;
    position: 'top' | 'bottom';
}

interface TourProps {
    steps: TourStep[];
    onComplete: () => void;
    onSkip: () => void;
}

export const Tour: React.FC<TourProps> = ({ steps, onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [position, setPosition] = useState<{top: number, left: number} | null>(null);

    const step = steps[currentStep];

    useEffect(() => {
        const updatePosition = () => {
            const element = document.getElementById(step.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setPosition({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
            }
        };

        const timer = setTimeout(updatePosition, 500);
        window.addEventListener('resize', updatePosition);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [currentStep, step.targetId]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm animate-fade-in touch-none">
            <div className="absolute inset-0 flex flex-col justify-end md:justify-center p-6 pb-32 pointer-events-none">
                <div className="pointer-events-auto bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-2xl max-w-md mx-auto w-full animate-slide-up border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1 block">
                                Adım {currentStep + 1} / {steps.length}
                            </span>
                            <h3 className="text-2xl font-bold text-black dark:text-white">{step.title}</h3>
                        </div>
                        <button onClick={onSkip} className="p-2 text-zinc-400 hover:text-black dark:hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
                        {step.description}
                    </p>
                    
                    <div className="flex gap-3">
                         <button 
                            onClick={handleNext}
                            className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                        >
                            {currentStep === steps.length - 1 ? 'Bitir' : 'İleri'} 
                            {currentStep === steps.length - 1 ? <Check size={18} /> : <ArrowRight size={18} />}
                        </button>
                    </div>
                    
                    <p className="text-center text-[10px] text-zinc-400 mt-4 uppercase tracking-widest">
                        Vurgulanan alana göz atın
                    </p>
                </div>
            </div>
            
            {/* Highlight Ring Helper */}
            {position && (() => {
                const element = document.getElementById(step.targetId);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                
                return (
                    <div 
                        className="absolute border-4 border-blue-500 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none transition-all duration-500 ease-out z-[90]"
                        style={{
                            top: rect.top - 8,
                            left: rect.left - 8,
                            width: rect.width + 16,
                            height: rect.height + 16,
                        }}
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full">
                            <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap">
                                Buraya Bak!
                            </div>
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-500 mx-auto"></div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
