import type { HTMLAttributes, ReactNode } from "react";

export type CalloutTone = "info" | "success" | "warning" | "danger";

type CalloutProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
  tone?: CalloutTone;
};

export function Callout({
  children,
  className = "",
  icon,
  title,
  tone = "info",
  ...props
}: CalloutProps) {
  return (
    <div {...props} className={`callout callout--${tone} ${className}`.trim()}>
      {icon && <span aria-hidden="true" className="callout__icon">{icon}</span>}
      <div className="callout__content">
        {title && <h3 className="callout__title">{title}</h3>}
        <div className="callout__body">{children}</div>
      </div>
    </div>
  );
}
