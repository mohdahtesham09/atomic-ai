import React from "react";

/**
 * AtomicLogo
 * Displays the Atomic AI logo with:
 *  - Fade + scale entry animation
 *  - Subtle floating loop animation
 *  - Hover glow effect
 *  - Smooth transitions between visible, soft, and ghost states
 *
 * @param {string} state - "visible", "soft", or "ghost". Controls opacity and scale.
 */
const AtomicLogo = ({ state = "visible" }) => {
  // Determine dynamic classes based on state
  const stateClasses = {
    visible: "opacity-100 scale-100 translate-y-0",
    soft: "opacity-40 scale-[0.98] -translate-y-2",
    ghost: "opacity-10 scale-[0.96] -translate-y-3 pointer-events-none"
  }[state] || "opacity-100 scale-100 translate-y-0";

  return (
    <>
      {/* Keyframe definitions scoped to this component */}
      <style>{`
        @keyframes fadeScaleIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0px) scale(1);
          }
        }

        @keyframes floatLogo {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .logo-entry {
          animation: fadeScaleIn 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .logo-float {
          animation: floatLogo 4s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`
          flex flex-col items-center justify-center
          transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${stateClasses}
        `}
        aria-hidden={state !== "visible"}
      >
        {/* Glow ring behind logo */}
        <div className='relative flex items-center justify-center'>
          {/* Outer ambient glow */}
          <div
            className='absolute rounded-full bg-cyan-300/30 blur-[90px] w-[240px] h-[160px]'
            aria-hidden='true'
          />

          {/* Logo image */}
          <div className="relative z-10 logo-entry">
            <img
              src='../../../public/logo.png'
              alt='Atomic AI Logo'
              className={`
                w-[180px] md:w-[240px] object-contain
                drop-shadow-[0_0_32px_rgba(103,232,249,0.35)]
                transition-transform duration-300 ease-out
                hover:scale-[1.04]
                logo-float
              `}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AtomicLogo;
