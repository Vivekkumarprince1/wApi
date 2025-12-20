import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  asChild?: boolean
}

function variantClass(variant: string | undefined) {
  switch (variant) {
    case 'destructive':
      return 'bg-red-600 text-white'
    case 'outline':
      return 'border bg-white'
    case 'secondary':
      return 'bg-gray-100 text-gray-900'
    case 'ghost':
      return 'bg-transparent'
    case 'link':
      return 'text-blue-600 underline'
    default:
      return 'bg-primary text-white'
  }
}

function sizeClass(size: string | undefined) {
  switch (size) {
    case 'sm':
      return 'h-8 px-3 text-xs'
    case 'lg':
      return 'h-10 px-8'
    case 'icon':
      return 'h-9 w-9 p-0'
    default:
      return 'h-9 px-4 py-2'
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = cn(
      'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50',
      variantClass(variant),
      sizeClass(size),
      className
    )

    const Comp: any = asChild ? 'div' : 'button'
    return (
      <Comp ref={ref} className={classes} {...props}>
        {children}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { Button }
