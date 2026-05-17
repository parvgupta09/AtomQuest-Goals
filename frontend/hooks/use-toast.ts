import { toast } from 'sonner'

interface Toast {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  return {
    toast: (props: Toast) => {
      if (props.variant === 'destructive') {
        toast.error(props.title, {
          description: props.description,
        })
      } else {
        toast.success(props.title, {
          description: props.description,
        })
      }
    },
  }
}
