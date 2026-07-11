import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export default function Button({
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`px-4 py-2 rounded-lg bg-[#7B6DED] text-white font-medium hover:bg-[#7B6DEE] transition-colors ${className} `}
      {...props}
    >
      {children}
    </button>
  );
}
