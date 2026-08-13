import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export const Reveal = ({ children, delay = 0, className = "", direction = "up" }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    let initial = { opacity: 0, y: 50 };
    if (direction === 'left') initial = { opacity: 0, x: -50 };
    if (direction === 'right') initial = { opacity: 0, x: 50 };
    if (direction === 'down') initial = { opacity: 0, y: -50 };

    return (
        <motion.div
            ref={ref}
            initial={initial}
            animate={isInView ? { opacity: 1, x: 0, y: 0 } : initial}
            transition={{ duration: 0.8, delay: delay / 1000, type: "spring", bounce: 0.3 }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

