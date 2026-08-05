import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ComponentPropsWithoutRef } from 'react'
import type { ReactNode } from 'react'
import { cxState } from './utils'

export interface TabItem {
  value: string
  label: ReactNode
  panel: ReactNode
}

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  items: TabItem[]
  className?: string
}

export type TabsRootProps = ComponentPropsWithoutRef<typeof BaseTabs.Root>
export type TabsListProps = ComponentPropsWithoutRef<typeof BaseTabs.List>
export type TabsTabProps = ComponentPropsWithoutRef<typeof BaseTabs.Tab>
export type TabsPanelProps = ComponentPropsWithoutRef<typeof BaseTabs.Panel>
export type TabsIndicatorProps = ComponentPropsWithoutRef<typeof BaseTabs.Indicator>

export function TabsRoot(props: TabsRootProps) {
  return <BaseTabs.Root {...props} />
}

export function TabsList(props: TabsListProps) {
  return <BaseTabs.List {...props} />
}

export function TabsTab(props: TabsTabProps) {
  return <BaseTabs.Tab {...props} />
}

export function TabsPanel({ className, ...props }: TabsPanelProps) {
  return <BaseTabs.Panel className={cxState('t-tabs-panel outline-none', className)} {...props} />
}

export function TabsIndicator(props: TabsIndicatorProps) {
  return <BaseTabs.Indicator {...props} />
}
