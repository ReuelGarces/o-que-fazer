import { PlusIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExpandingIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  text: string;
};

export default function ExpandingIconButton({
  "aria-label": ariaLabel,
  className,
  text,
  type = "button",
  ...props
}: ExpandingIconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={ariaLabel ?? text}
      className={cn("expanding-icon-button", className)}
      size="default"
      type={type}
      variant="primary"
    >
      <PlusIcon aria-hidden="true" className="expanding-icon-button__icon" size={16} strokeWidth={1.6} />
      <span className="expanding-icon-button__label">{text}</span>
    </Button>
  );
}
