import * as React from "react"
import { cn } from "../../utils/cn"

const variants = {
  default: "cyber-button",
  outline: "border border-primary/50 bg-background/80 text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all duration-300",
  ghost: "hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] text-muted-foreground transition-all duration-300",
  link: "text-primary underline-offset-4 hover:underline neon-text",
  cyber: "relative overflow-hidden bg-primary/20 text-primary border border-primary/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] hover:bg-primary/30 transition-all duration-300 before:absolute before:inset-0 before:bg-[linear-gradient(45deg,transparent,rgba(0,240,255,0.4),transparent)] before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 active:scale-95 group",
}

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
}

const Button = React.forwardRef(({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
  const Comp = "button"
  
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative z-20",
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <span className="absolute inset-0 rounded-md ring-0 ring-primary/50 transition-all duration-300 group-active:ring-4 opacity-0 group-active:opacity-100" />
    </Comp>
  )
})
Button.displayName = "Button"

export { Button }
