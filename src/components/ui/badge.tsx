import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        saber: "border-transparent bg-saber/15 text-saber hover:bg-saber/20",
        ter: "border-transparent bg-ter/15 text-ter hover:bg-ter/20",
        executar: "border-transparent bg-executar/15 text-executar hover:bg-executar/20",
        potencializar: "border-transparent bg-potencializar/15 text-potencializar hover:bg-potencializar/20",
        saudavel: "border-transparent bg-emerald-100 text-emerald-700",
        alerta: "border-transparent bg-amber-100 text-amber-800",
        cuidado: "border-transparent bg-orange-100 text-orange-800",
        critico: "border-transparent bg-red-100 text-red-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
