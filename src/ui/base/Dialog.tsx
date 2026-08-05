import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import {
  createElement,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref
} from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import { cx, cxState } from './utils'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

type BaseDialogRootProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>
type BaseDialogPortalProps = ComponentPropsWithoutRef<typeof BaseDialog.Portal>
type BaseDialogPopupProps = ComponentPropsWithoutRef<typeof BaseDialog.Popup>
type BaseDialogTitleProps = ComponentPropsWithoutRef<typeof BaseDialog.Title>
type BaseDialogDescriptionProps = ComponentPropsWithoutRef<typeof BaseDialog.Description>
type BaseDialogBackdropProps = ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
type BaseDialogCloseProps = ComponentPropsWithoutRef<typeof BaseDialog.Close>

type DialogTitleElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export interface DialogOverlayProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  open: boolean
  onOpenChange?: (open: boolean, event?: Event) => void
  triggerId?: string | null
  modal?: BaseDialogRootProps['modal']
  disablePointerDismissal?: BaseDialogRootProps['disablePointerDismissal']
  keepMounted?: BaseDialogPortalProps['keepMounted']
  portalContainer?: BaseDialogPortalProps['container']
  ref?: Ref<HTMLDivElement>
}

export function DialogOverlay({
  open,
  onOpenChange,
  triggerId,
  modal,
  disablePointerDismissal,
  keepMounted = true,
  portalContainer,
  children,
  ref,
  ...overlayProps
}: DialogOverlayProps) {
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails.event)
      }}
      triggerId={triggerId}
      modal={modal}
      disablePointerDismissal={disablePointerDismissal}
    >
      <BaseDialog.Portal keepMounted={keepMounted} container={portalContainer}>
        <div ref={ref} {...overlayProps}>{children}</div>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export interface DialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  motionClassName?: string
  ref?: Ref<HTMLDivElement>
  unanimated?: boolean
}

export function DialogPanel({
  className,
  motionClassName,
  motionVariant = 'dialog',
  ref,
  unanimated = false,
  ...props
}: DialogPanelProps) {
  if (unanimated) {
    return <BaseDialog.Popup ref={ref} className={className} {...props} />
  }

  return (
    <BaseDialog.Popup
      ref={ref}
      render={<MotionPanel variant={motionVariant} className={cx(className, motionClassName)} />}
      {...props}
    />
  )
}

export interface InlineDialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
}

export function InlineDialogPanel({ className, ...props }: InlineDialogPanelProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const setInlinePortalContainer = useCallback((element: HTMLDivElement | null) => {
    setPortalContainer(element)
  }, [])

  return (
    <BaseDialog.Root open modal={false}>
      {portalContainer ? (
        <BaseDialog.Portal keepMounted container={portalContainer}>
          <BaseDialog.Popup className={className} {...props} />
        </BaseDialog.Portal>
      ) : null}
      <div ref={setInlinePortalContainer} />
    </BaseDialog.Root>
  )
}

export interface DialogTitleProps extends BaseDialogTitleProps {
  as?: DialogTitleElement
}

export function DialogTitle({ as, render, ...props }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      render={render ?? (as ? createElement(as) : undefined)}
      {...props}
    />
  )
}

export function DialogDescription(props: BaseDialogDescriptionProps) {
  return <BaseDialog.Description {...props} />
}

export function DialogBackdrop({ className, ...props }: BaseDialogBackdropProps) {
  return <BaseDialog.Backdrop className={cxState('t-modal-backdrop', className)} {...props} />
}

export function DialogClose(props: BaseDialogCloseProps) {
  return <BaseDialog.Close {...props} />
}
