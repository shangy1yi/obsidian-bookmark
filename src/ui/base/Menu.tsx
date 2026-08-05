import type { ComponentPropsWithRef, ReactNode } from 'react'

export interface MenuAction {
  id: string
  label: ReactNode
  disabled?: boolean
  destructive?: boolean
  onSelect?: () => void
}

export interface MenuProps {
  trigger: ReactNode
  actions: MenuAction[]
  triggerProps?: ComponentPropsWithRef<'button'> & {
    [key: `data-${string}`]: string | undefined
  }
}

export {
  InlineMenu
} from './InlineMenu.js'
export type {
  InlineMenuAction,
  InlineMenuProps
} from './InlineMenu.js'
export {
  InlineMenuList
} from './InlineMenuList.js'
export type {
  InlineMenuListProps
} from './InlineMenuList.js'
