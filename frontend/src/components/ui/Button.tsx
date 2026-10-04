import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-hover',
  outline: 'border border-border bg-surface text-foreground hover:bg-page active:bg-line/50',
  ghost: 'text-foreground hover:bg-page active:bg-line/50',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-hover',
  link: 'h-auto px-0 text-primary underline-offset-2 hover:underline',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-small',
  md: 'h-10 px-4 text-body-small',
  lg: 'h-12 px-6 text-body',
  icon: 'h-10 w-10 p-0',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  // Renderiza um <Link> com o mesmo visual (ações de navegação viram links reais)
  to?: string
}

function buttonClasses({ variant, size, className }: { variant: ButtonVariant; size: ButtonSize; className?: string }) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded font-medium transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    variant !== 'link' && SIZES[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', to, ...rest }, ref) => {
    const classes = buttonClasses({ variant, size, className })
    if (to) {
      // handlers/attrs de <button> são compatíveis com <a> em runtime; o cast cobre
      // só a diferença de tipos do React (HTMLButtonElement vs HTMLAnchorElement)
      const linkProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>
      return (
        <Link to={to} aria-disabled={disabled || loading || undefined} className={classes} {...linkProps}>
          {loading && (
            <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {children}
        </Link>
      )
    }
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
        {...rest}
      >
        {loading && (
          <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
