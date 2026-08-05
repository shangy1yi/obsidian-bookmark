import { BackupControls } from './BackupControls.js'
import { DuplicateControls, DuplicateResultsControls } from './DuplicateControls.js'
import { DuplicateGroups } from './DuplicateGroups.js'
import { FolderCleanupControls } from './FolderCleanupControls.js'
import { FolderCleanupResults } from './FolderCleanupResults.js'
import { IgnoreRules } from './IgnoreRules.js'
import {
  OPTION_PANEL_CLASS,
  OPTION_TOOL_PANEL_CLASS
} from './option-layout-classes.js'
import { OptionPanelHeader } from './OptionPanelHeader.js'
import { RedirectControls } from './RedirectControls.js'
import { RedirectResults } from './RedirectResults.js'
import { RecycleBin } from './RecycleBin.js'
import { RecycleControls } from './RecycleControls.js'
import { ResultsPagination } from './ResultsPagination.js'
import { ScopePickerTrigger } from './ScopePickerTrigger.js'
import { AvailabilityHistory } from './AvailabilityHistory.js'

interface OptionsPanelVisibilityProps {
  hidden: boolean
}

const AVAILABILITY_HISTORY_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const REDIRECTS_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const RECYCLE_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const FOLDER_CLEANUP_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS
const DUPLICATES_GROUP_CLASS =
  OPTION_TOOL_PANEL_CLASS

export function HistoryPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="history" className={OPTION_PANEL_CLASS} aria-labelledby="history-title" hidden={hidden}>
      <OptionPanelHeader titleId="history-title" title="检测历史" description="查看最近的书签可用性检测记录与处理状态。" />

      <ScopePickerTrigger source="history" />

      <div className={AVAILABILITY_HISTORY_GROUP_CLASS}>
        <AvailabilityHistory />
      </div>
    </section>
  )
}

export function BackupPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="backup" className={OPTION_PANEL_CLASS} aria-labelledby="backup-title" hidden={hidden}>
      <OptionPanelHeader titleId="backup-title" title="数据与备份" description="导入、导出和恢复 Curator 的本地设置与书签辅助数据。" />

      <BackupControls />
    </section>
  )
}

export function RedirectsPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="redirects" className={OPTION_PANEL_CLASS} aria-labelledby="redirects-title" hidden={hidden}>
      <OptionPanelHeader titleId="redirects-title" title="重定向更新" description="识别发生跳转的链接，并在确认后更新书签地址。" />

      <div className={REDIRECTS_GROUP_CLASS}>
        <RedirectControls />
        <RedirectResults />
        <ResultsPagination kind="redirects" ariaLabel="重定向结果分页" />
      </div>
    </section>
  )
}

export function DuplicatesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="duplicates" className={OPTION_PANEL_CLASS} aria-labelledby="duplicates-title" hidden={hidden}>
      <OptionPanelHeader titleId="duplicates-title" title="重复书签检测" description="找出指向相同内容的书签，比较后保留更合适的版本。" />

      <DuplicateControls />

      <div className={DUPLICATES_GROUP_CLASS}>
        <DuplicateResultsControls />
        <DuplicateGroups />
      </div>
    </section>
  )
}

export function FolderCleanupPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="folder-cleanup" className={OPTION_PANEL_CLASS} aria-labelledby="folder-cleanup-title" hidden={hidden}>
      <OptionPanelHeader titleId="folder-cleanup-title" title="文件夹清理" description="发现空文件夹和可简化的层级，让书签结构保持清晰。" />

      <div className={FOLDER_CLEANUP_GROUP_CLASS}>
        <FolderCleanupControls />
        <FolderCleanupResults />
      </div>
    </section>
  )
}

export function IgnoreRulesPanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="ignore" className={OPTION_PANEL_CLASS} aria-labelledby="ignore-title" hidden={hidden}>
      <OptionPanelHeader titleId="ignore-title" title="忽略规则" description="管理检测与整理时需要跳过的域名、链接或书签范围。" />

      <IgnoreRules />
    </section>
  )
}

export function RecyclePanel({ hidden }: OptionsPanelVisibilityProps) {
  return (
    <section id="recycle" className={OPTION_PANEL_CLASS} aria-labelledby="recycle-title" hidden={hidden}>
      <OptionPanelHeader titleId="recycle-title" title="回收站" description="恢复暂时移除的书签，或永久清理不再需要的内容。" />

      <div className={RECYCLE_GROUP_CLASS}>
        <RecycleControls />
        <RecycleBin />
      </div>
    </section>
  )
}
