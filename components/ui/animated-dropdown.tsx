"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

type MenuPosition = {
  center: number;
  top: number;
  width: number;
};

type AnimatedDropdownProps<Value extends string> = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  leadingIcon?: LucideIcon;
  onChange: (value: Value) => void;
  options: readonly Value[];
  value: Value;
};

const MENU_WIDTH = 148;
const MENU_ROW_HEIGHT = 36;
const MENU_VERTICAL_PADDING = 14;
const VIEWPORT_GUTTER = 12;

const panelVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut" as const,
      staggerChildren: 0.03,
    },
  },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

const optionVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export function AnimatedDropdown<Value extends string>({
  ariaLabel,
  className,
  disabled = false,
  leadingIcon: LeadingIcon,
  onChange,
  options,
  value,
}: AnimatedDropdownProps<Value>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.indexOf(value)),
  );
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    const width = Math.min(
      Math.max(bounds.width, MENU_WIDTH),
      window.innerWidth - VIEWPORT_GUTTER * 2,
    );
    const height = options.length * MENU_ROW_HEIGHT + MENU_VERTICAL_PADDING;
    const below = bounds.bottom + 8;
    const top =
      below + height <= window.innerHeight - VIEWPORT_GUTTER
        ? below
        : Math.max(VIEWPORT_GUTTER, bounds.top - height - 8);
    const minCenter = VIEWPORT_GUTTER + width / 2;
    const maxCenter = window.innerWidth - VIEWPORT_GUTTER - width / 2;
    const center = Math.max(
      minCenter,
      Math.min(bounds.left + bounds.width / 2, maxCenter),
    );

    setPosition({ center, top, width });
  }, [options.length]);

  const openMenu = useCallback(() => {
    setActiveIndex(Math.max(0, options.indexOf(value)));
    updatePosition();
    setIsOpen(true);
  }, [options, updatePosition, value]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [closeMenu, isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  const moveFocus = (index: number) => {
    const nextIndex = (index + options.length) % options.length;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(options.length - 1);
    }
  };

  const menu = typeof document === "undefined"
    ? null
    : createPortal(
        <AnimatePresence>
          {isOpen && position && (
            <motion.div
              animate="visible"
              aria-label={ariaLabel}
              className="animated-dropdown__menu"
              id={menuId}
              initial={reduceMotion ? false : "hidden"}
              onKeyDown={handleMenuKeyDown}
              ref={menuRef}
              role="menu"
              style={{
                left: position.center,
                marginLeft: -position.width / 2,
                minWidth: position.width,
                top: position.top,
                transformOrigin: "top center",
                width: position.width,
              }}
              variants={panelVariants}
              exit={reduceMotion ? { opacity: 0 } : "exit"}
            >
              {options.map((option, index) => {
                const selected = option === value;
                return (
                  <motion.button
                    aria-checked={selected}
                    className="animated-dropdown__option"
                    key={option}
                    onClick={() => {
                      if (!selected) onChange(option);
                      closeMenu(true);
                    }}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    role="menuitemradio"
                    tabIndex={index === activeIndex ? 0 : -1}
                    type="button"
                    variants={optionVariants}
                  >
                    <span>{option}</span>
                    {selected && <Check aria-hidden="true" size={14} />}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      );

  return (
    <>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${ariaLabel}: ${value}`}
        className={cn("status-mark", className)}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        {LeadingIcon && <LeadingIcon aria-hidden="true" size={14} strokeWidth={1.6} />}
        <span>{value}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          aria-hidden="true"
          className="status-mark__chevron"
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeInOut" }}
        >
          <ChevronDown size={12} strokeWidth={2} />
        </motion.span>
      </button>
      {menu}
    </>
  );
}
