import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const NeuralCursor: React.FC = () => {
    const cursorRef = useRef<HTMLDivElement>(null);
    const followerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cursor = cursorRef.current;
        const follower = followerRef.current;
        if (!cursor || !follower) return;

        // GSAP QuickSetters for high performance
        const xCursor = gsap.quickSetter(cursor, "x", "px");
        const yCursor = gsap.quickSetter(cursor, "y", "px");
        const xFollower = gsap.quickSetter(follower, "x", "px");
        const yFollower = gsap.quickSetter(follower, "y", "px");

        const onMouseMove = (e: MouseEvent) => {
            xCursor(e.clientX);
            yCursor(e.clientY);
            
            // Follower has a slight delay (0.15s) for elegance
            gsap.to({}, {
                duration: 0.15,
                onUpdate: () => {
                    xFollower(e.clientX);
                    yFollower(e.clientY);
                }
            });
        };

        const onMouseEnter = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isClickable = target.closest('button, a, input, [role="button"], .cursor-pointer');
            
            if (isClickable) {
                gsap.to(follower, {
                    scale: 2.5,
                    backgroundColor: 'rgba(0, 255, 128, 0.1)',
                    borderColor: 'rgba(0, 255, 128, 0.5)',
                    duration: 0.3,
                    ease: "power2.out"
                });
                gsap.to(cursor, {
                    scale: 0.5,
                    opacity: 0,
                    duration: 0.2
                });
            }
        };

        const onMouseLeave = () => {
            gsap.to(follower, {
                scale: 1,
                backgroundColor: 'transparent',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                duration: 0.3,
                ease: "power2.out"
            });
            gsap.to(cursor, {
                scale: 1,
                opacity: 1,
                duration: 0.2
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseover', onMouseEnter);
        window.addEventListener('mouseout', onMouseLeave);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseover', onMouseEnter);
            window.removeEventListener('mouseout', onMouseLeave);
        };
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden hidden md:block">
            {/* The core dot */}
            <div 
                ref={cursorRef}
                className="w-1.5 h-1.5 bg-bio-neon-green rounded-full fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 shadow-bio-neon"
            />
            {/* The trailing ring */}
            <div 
                ref={followerRef}
                className="w-10 h-10 border border-white/20 rounded-full fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 transition-colors duration-300"
            />
        </div>
    );
};

export default NeuralCursor;
