import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { children, className = '', label, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        aria-label={label}
        className={`icon-button ${className}`.trim()}
        ref={ref}
        title={label}
        type={type}
      >
        {children}
      </button>
    )
  },
)
