"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

type DropdownOption<Value extends string> = {
  value: Value;
  label: string;
};

type DropdownOptionInput<Value extends string> =
  | Value
  | DropdownOption<Value>;

type MenuPosition = {
  center: number;
  top: number;
  width: number;
  maxHeight: number;
};

type AnimatedDropdownProps<Value extends string> = {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  defaultValue?: Value;
  disabled?: boolean;
  id?: string;
  leadingIcon?: LucideIcon;
  name?: string;
  onChange?: (value: Value) => void;
  options: readonly DropdownOptionInput<Value>[];
  value?: Value;
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
  ariaLabelledBy,
  className,
  defaultValue,
  disabled = false,
  id,
  leadingIcon: LeadingIcon,
  name,
  onChange,
  options,
  value,
}: AnimatedDropdownProps<Value>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const triggerId = id ?? menuId + "-trigger";
  const reduceMotion = useReducedMotion();
  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : option,
      ),
    [options],
  );
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<Value | undefined>(
    () => defaultValue ?? value ?? normalizedOptions[0]?.value,
  );
  const currentValue =
    value ?? uncontrolledValue ?? normalizedOptions[0]?.value;
  const selectedOption =
    normalizedOptions.find((option) => option.value === currentValue) ??
    normalizedOptions[0];
  const selectedLabel = selectedOption?.label ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      normalizedOptions.findIndex((option) => option.value === currentValue),
    ),
  );
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) context.font = '14px "DM Sans", Arial, sans-serif';
    const widestOption = context
      ? Math.max(
          0,
          ...normalizedOptions.map(
            (option) => context.measureText(option.label).width,
          ),
        )
      : 0;
    const requestedWidth = Math.max(
      bounds.width,
      MENU_WIDTH,
      Math.ceil(widestOption + 40),
    );
    const width = Math.min(
      requestedWidth,
      window.innerWidth - VIEWPORT_GUTTER * 2,
    );
    const maxHeight = window.innerHeight - VIEWPORT_GUTTER * 2;
    const height = Math.min(
      normalizedOptions.length * MENU_ROW_HEIGHT + MENU_VERTICAL_PADDING,
      maxHeight,
    );
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

    setPosition({ center, top, width, maxHeight });
  }, [normalizedOptions]);

  const openMenu = useCallback(() => {
    if (normalizedOptions.length === 0) return;
    setActiveIndex(
      Math.max(
        0,
        normalizedOptions.findIndex(
          (option) => option.value === currentValue,
        ),
      ),
    );
    updatePosition();
    setIsOpen(true);
  }, [currentValue, normalizedOptions, updatePosition]);

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
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
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
    const nextIndex = (index + normalizedOptions.length) % normalizedOptions.length;
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
      moveFocus(normalizedOptions.length - 1);
    }
  };

  const menu =
    typeof document === "undefined"
      ? null
      : createPortal(
          <AnimatePresence>
            {isOpen && position && (
              <motion.div
                animate="visible"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                className="animated-dropdown__menu dropdown-panel-surface"
                id={menuId}
                initial={reduceMotion ? false : "hidden"}
                onKeyDown={handleMenuKeyDown}
                ref={menuRef}
                role="listbox"
                style={{
                  left: position.center,
                  marginLeft: -position.width / 2,
                  maxHeight: position.maxHeight,
                  minWidth: position.width,
                  top: position.top,
                  transformOrigin: "top center",
                  width: position.width,
                }}
                variants={panelVariants}
                exit={reduceMotion ? { opacity: 0 } : "exit"}
              >
                {normalizedOptions.map((option, index) => {
                  const selected = option.value === currentValue;
                  return (
                    <motion.button
                      aria-selected={selected}
                      className="animated-dropdown__option"
                      key={option.value}
                      onClick={() => {
                        if (!selected) {
                          if (!isControlled) {
                            setUncontrolledValue(option.value);
                          }
                          onChange?.(option.value);
                        }
                        closeMenu(true);
                      }}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      tabIndex={index === activeIndex ? 0 : -1}
                      type="button"
                      variants={optionVariants}
                    >
                      <span>{option.label}</span>
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
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn("animated-dropdown__trigger", className)}
        disabled={disabled}
        id={triggerId}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu();
          }
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        {LeadingIcon && (
          <LeadingIcon aria-hidden="true" size={14} strokeWidth={1.6} />
        )}
        <span className="animated-dropdown__value">{selectedLabel}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          aria-hidden="true"
          className="animated-dropdown__chevron"
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeInOut" }}
        >
          <ChevronDown size={12} strokeWidth={2} />
        </motion.span>
      </button>
      {name && currentValue !== undefined && (
        <input
          disabled={disabled}
          name={name}
          type="hidden"
          value={currentValue}
        />
      )}
      {menu}
    </>
  );
}
