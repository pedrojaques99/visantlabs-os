import React from 'react';

interface AnimatedDiceIconProps {
  size?: number;
  className?: string;
}

export const AnimatedDiceIcon: React.FC<AnimatedDiceIconProps> = ({ 
  size = 16, 
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animated-dice-icon ${className}`}
      aria-hidden="true"
    >
      {/* Dado de trás (menor, mais atrás) */}
      <g className="dice-back">
        <rect
          x="6"
          y="2"
          width="8"
          height="8"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </g>
      
      {/* Dado da frente (maior, com ponto) */}
      <g className="dice-front">
        <rect
          x="2"
          y="6"
          width="8"
          height="8"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Ponto central no dado da frente */}
        <circle
          cx="6"
          cy="10"
          r="1"
          fill="currentColor"
        />
      </g>
    </svg>
  );
};

