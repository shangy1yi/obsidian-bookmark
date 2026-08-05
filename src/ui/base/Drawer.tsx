import type { ReactNode } from 'react'
export { DrawerClose } from './DrawerClose.js'
export { DrawerOverlay, type DrawerOverlayProps } from './DrawerOverlay.js'
export { DrawerPanel, type DrawerPanelProps } from './DrawerPanel.js'

export interface DrawerProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

