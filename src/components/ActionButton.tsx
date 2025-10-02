import React from "react";
import { Link, NavLink } from "react-router-dom";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "link";
  as?: "button" | "link" | "navlink";
  to?: string;
  end?: boolean;
}

const ActionButton: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  as = "button",
  to = "#",
  end,
  ...rest
}) => {
  const baseStyles = "justify-center flex w-full cursor-pointer";
  const variants = {
    primary: "bg-button hover:bg-active-but py-2 px-4 rounded-md",
    link: "text-link w-max mx-auto text-xs",
  };

  const styles = `${baseStyles} ${variants[variant]} ${className}`;

  if (as === "link") {
    return (
      <Link to={to} className={styles}>
        {children}
      </Link>
    );
  }

  if (as === "navlink") {
    return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `${styles} ${isActive ? "ring-2 ring-blue-400" : ""}`
        }
      >
        {children}
      </NavLink>
    );
  }

  return (
    <button {...rest} className={styles}>
      {children}
    </button>
  );
};

export default ActionButton;
