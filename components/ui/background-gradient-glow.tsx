import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function BackgroundGradientGlow({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("relative isolate min-h-screen w-full", className)} {...props}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
        style={{
          background: `
            radial-gradient(ellipse 85% 65% at 8% 8%, rgba(175, 109, 255, 0.42), transparent 60%),
            radial-gradient(ellipse 75% 60% at 75% 35%, rgba(255, 235, 170, 0.55), transparent 62%),
            radial-gradient(ellipse 70% 60% at 15% 80%, rgba(255, 100, 180, 0.40), transparent 62%),
            radial-gradient(ellipse 70% 60% at 92% 92%, rgba(120, 190, 255, 0.45), transparent 62%),
            linear-gradient(180deg, #f7eaff 0%, #fde2ea 100%)
          `,
        }}
      />
      {children}
    </div>
  );
}

export { BackgroundGradientGlow as Component };
