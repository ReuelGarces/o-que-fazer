"use client";

import { ArrowRight } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type InteractiveHoverButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  startIcon?: ReactNode;
  text: string;
};

const InteractiveHoverButton = forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  function InteractiveHoverButton({ className, startIcon, text, type = "button", ...props }, ref) {
    return (
      <button
        {...props}
        className={cn("interactive-hover-button", className)}
        ref={ref}
        type={type}
      >
        <span className="interactive-hover-button__label">
          {startIcon && <span className="interactive-hover-button__icon">{startIcon}</span>}
          <span className="interactive-hover-button__text">{text}</span>
        </span>
        <span aria-hidden="true" className="interactive-hover-button__hover-label"><span>{text}</span><ArrowRight size={16} /></span>
        <span aria-hidden="true" className="interactive-hover-button__fill" />
      </button>
    );
  },
);

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
