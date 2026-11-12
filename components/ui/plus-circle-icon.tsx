import type { SVGProps } from "react";

export function PlusCircleIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      className="plus-circle-icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path className="plus-circle-icon__ring" d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9Z" strokeDasharray="60" />
      <path className="plus-circle-icon__mark plus-circle-icon__mark--horizontal" d="M7 12h10" strokeDasharray="12" />
      <path className="plus-circle-icon__mark plus-circle-icon__mark--vertical" d="M12 7v10" strokeDasharray="12" />
    </svg>
  );
}
