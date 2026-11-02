import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[hsl(40,33%,99%)] group-[.toaster]:text-[hsl(220,16%,8%)] group-[.toaster]:border-[hsl(220,13%,91%)] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:font-sans',
          description: 'group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:bg-[#cfe0fb] group-[.toaster]:text-[#2f63d8] group-[.toaster]:border-[#a7c5f6]',
          error:
            'group-[.toaster]:bg-rose-50 group-[.toaster]:text-rose-700 group-[.toaster]:border-rose-200',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
