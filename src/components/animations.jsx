import { useState, useEffect, useRef } from 'react';

export const useIntersectionObserver = (options) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsIntersecting(true);
                if (ref.current) observer.unobserve(ref.current);
            }
        }, options);
        if (ref.current) observer.observe(ref.current);
        return () => { if (ref.current) observer.unobserve(ref.current); };
    }, [options]);

    return [ref, isIntersecting];
};

export const Reveal = ({ children, delay = 0, className = "", direction = "up" }) => {
    const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.1 });
    let initialTransform = 'translate-y-12';
    if (direction === 'left') initialTransform = '-translate-x-12';
    if (direction === 'right') initialTransform = 'translate-x-12';

    return (
        <div
            ref={ref}
            className={`transition-all duration-1000 ease-out ${isIntersecting ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : `opacity-0 ${initialTransform} scale-95`} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

