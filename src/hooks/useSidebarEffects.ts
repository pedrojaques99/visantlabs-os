import { useState, useEffect, useRef, RefObject } from 'react';
import { DesignType } from '@/types/types';

interface UseSidebarEffectsProps {
    sidebarRef: RefObject<HTMLElement>;
    onSidebarWidthChange: (width: number) => void;
    hasAnalyzed: boolean;
    hasGenerated: boolean;
    designType: DesignType | undefined;
    brandingComplete: boolean;
    categoriesComplete: boolean;
}

export const useSidebarEffects = ({
    sidebarRef,
    onSidebarWidthChange,
    hasAnalyzed,
    hasGenerated,
    designType,
    brandingComplete,
    categoriesComplete,
}: UseSidebarEffectsProps) => {
    const [isLargeScreen, setIsLargeScreen] = useState(false);
    const [hasScrolledToBranding, setHasScrolledToBranding] = useState(false);
    const [hasScrolledToCategories, setHasScrolledToCategories] = useState(false);
    const [hasScrolledToRefine, setHasScrolledToRefine] = useState(false);
    const resizerRef = useRef<HTMLDivElement>(null);

    // Check screen size for responsive width
    useEffect(() => {
        const checkScreenSize = () => {
            // Use lg breakpoint (1024px) for large screens where sidebar can be resized
            setIsLargeScreen(window.innerWidth >= 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Setup resizer functionality
    useEffect(() => {
        if (!hasAnalyzed) return;
        if (!resizerRef.current || !sidebarRef.current) return;

        const resizer = resizerRef.current;
        const sidebar = sidebarRef.current;

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = sidebar.offsetWidth;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const handleMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                const newWidth = startWidth + dx;
                // 30% maior: 380 * 1.3 = 494, 800 * 1.3 = 1040
                const minWidth = 494;
                const maxWidth = 1040;

                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    onSidebarWidthChange(newWidth);
                }
            };

            const handleMouseUp = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        };

        resizer.addEventListener('mousedown', handleMouseDown);

        return () => {
            resizer.removeEventListener('mousedown', handleMouseDown);
        };
    }, [hasAnalyzed, sidebarRef, onSidebarWidthChange]);

    // Auto-scroll to branding section when design type is selected
    useEffect(() => {
        if (designType && !hasScrolledToBranding && !hasGenerated) {
            setHasScrolledToBranding(true);
            setTimeout(() => {
                const brandingSection = document.getElementById('branding-section');
                const sidebar = document.getElementById('sidebar');
                if (brandingSection && sidebar) {
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const elementRect = brandingSection.getBoundingClientRect();
                    const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

                    sidebar.scrollTo({
                        top: relativeTop - 20,
                        behavior: 'smooth'
                    });
                }
            }, 200);
        }
    }, [designType, hasScrolledToBranding, hasGenerated]);

    // Auto-scroll to categories section when branding is complete
    useEffect(() => {
        if (brandingComplete && !hasScrolledToCategories && !hasGenerated) {
            setHasScrolledToCategories(true);
            setTimeout(() => {
                const categoriesSection = document.getElementById('categories-section');
                const sidebar = document.getElementById('sidebar');
                if (categoriesSection && sidebar) {
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const elementRect = categoriesSection.getBoundingClientRect();
                    const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

                    sidebar.scrollTo({
                        top: relativeTop - 20,
                        behavior: 'smooth'
                    });
                }
            }, 200);
        }
    }, [brandingComplete, hasScrolledToCategories, hasGenerated]);

    // Auto-scroll to refine section when categories are complete
    useEffect(() => {
        if (categoriesComplete && !hasScrolledToRefine && !hasGenerated) {
            setHasScrolledToRefine(true);
            setTimeout(() => {
                const refineSection = document.getElementById('refine-section');
                const sidebar = document.getElementById('sidebar');
                if (refineSection && sidebar) {
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const elementRect = refineSection.getBoundingClientRect();
                    const relativeTop = elementRect.top - sidebarRect.top + sidebar.scrollTop;

                    sidebar.scrollTo({
                        top: relativeTop - 20,
                        behavior: 'smooth'
                    });
                }
            }, 200);
        }
    }, [categoriesComplete, hasScrolledToRefine, hasGenerated]);

    // Reset scroll states when values are reset
    useEffect(() => {
        if (!designType) {
            setHasScrolledToBranding(false);
        }
        if (!brandingComplete) {
            setHasScrolledToCategories(false);
        }
        if (!categoriesComplete) {
            setHasScrolledToRefine(false);
        }
    }, [designType, brandingComplete, categoriesComplete]);

    return {
        isLargeScreen,
        resizerRef,
    };
};
