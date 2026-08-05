import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  type RefObject
} from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { NEWTAB_SEARCH_BACKGROUND_MIN } from '../newtab-search-settings-store'
import {
  setNewtabSearchWidgetNodes,
  type NewtabSearchWidgetView,
  type SearchChipViewModel,
  type SearchHintState,
  type SearchSuggestionViewModel
} from '../newtab-search-widget-store'
import {
  SEARCH_CHIPS_CLASS,
  SEARCH_CLEAR_BUTTON_CLASS,
  SEARCH_ENGINE_BUTTON_CLASS,
  SEARCH_ENGINE_CARET_CLASS,
  SEARCH_FORM_CLASS,
  SEARCH_FORM_PANEL_OPEN_CLASS,
  SEARCH_HINT_CLASS,
  SEARCH_ICON_CLASS,
  SEARCH_INPUT_CLASS,
  SEARCH_NATURAL_PENDING_DOT_CLASS,
  SEARCH_PANEL_CLASS,
  SEARCH_SECTION_LABEL_CLASS,
  SEARCH_SEPARATOR_CLASS,
  SEARCH_SHELL_CLASS,
  SEARCH_SLOT_CLASS,
  SEARCH_SUBMIT_BUTTON_CLASS,
  SEARCH_SUBMIT_ICON_CLASS,
  SEARCH_SUGGESTION_COPY_CLASS,
  SEARCH_SUGGESTION_META_CLASS,
  SEARCH_SUGGESTION_TITLE_CLASS,
  SEARCH_SUGGESTIONS_CLASS,
  SEARCH_SLOT_PENDING_LAYOUT_CLASS,
  SEARCH_WEB_HINT_CLASS,
  getSearchChipClass,
  getSearchNaturalButtonClass,
  getSearchSuggestionClass,
  getSearchSuggestionMarkClass
} from './searchWidgetClasses'

type NewtabSearchEngineMenuComponent = (typeof import('./NewtabSearchEngineMenu'))['NewtabSearchEngineMenu']

let newtabSearchEngineMenuComponent: NewtabSearchEngineMenuComponent | null = null
let newtabSearchEngineMenuPromise: Promise<NewtabSearchEngineMenuComponent> | null = null

function loadNewtabSearchEngineMenu(): Promise<NewtabSearchEngineMenuComponent> {
  if (newtabSearchEngineMenuComponent) {
    return Promise.resolve(newtabSearchEngineMenuComponent)
  }
  newtabSearchEngineMenuPromise ||= import('./NewtabSearchEngineMenu').then((module) => {
    newtabSearchEngineMenuComponent = module.NewtabSearchEngineMenu
    return module.NewtabSearchEngineMenu
  })
  return newtabSearchEngineMenuPromise
}

function handleSearchContextMenu(event: ReactMouseEvent<HTMLDivElement>): void {
  event.stopPropagation()
}

export function NewtabSearchWidget({ view }: { view: NewtabSearchWidgetView }) {
  const slotRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const engineButtonRef = useRef<HTMLButtonElement | null>(null)
  const engineMenuRef = useRef<HTMLDivElement | null>(null)
  const shell = view.shell
  const slotStyle = useMemo(() => ({
    '--search-width': `${shell.width}vw`,
    '--search-height': `${shell.height}px`,
    '--search-offset-y': `${shell.offsetY}px`,
    ...(shell.autoVerticalCenter && !shell.layoutReady
      ? {
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden'
        }
      : null)
  }) as CSSProperties, [shell.autoVerticalCenter, shell.height, shell.layoutReady, shell.offsetY, shell.width])
  const formStyle = useMemo(() => ({
    '--search-width': `${shell.width}vw`,
    '--search-height': `${shell.height}px`,
    '--search-bg-alpha': String(Math.max(
      Number(shell.backgroundAlpha) || 0,
      NEWTAB_SEARCH_BACKGROUND_MIN / 100
    ))
  }) as CSSProperties, [shell.backgroundAlpha, shell.height, shell.width])

  useLayoutEffect(() => {
    const nodes = {
      engineButton: engineButtonRef.current,
      engineMenu: engineMenuRef.current,
      input: inputRef.current,
      slot: slotRef.current
    }
    setNewtabSearchWidgetNodes(nodes)
    view.onNodesChange?.(nodes)
  })

  useEffect(() => {
    const onNodesChange = view.onNodesChange
    return () => {
      const nodes = {
        engineButton: null,
        engineMenu: null,
        input: null,
        slot: null
      }
      setNewtabSearchWidgetNodes(nodes)
      onNodesChange?.(nodes)
    }
  }, [view.onNodesChange])

  return (
    <section
      className={[
        SEARCH_SLOT_CLASS,
        shell.autoVerticalCenter && !shell.layoutReady && SEARCH_SLOT_PENDING_LAYOUT_CLASS
      ].filter(Boolean).join(' ')}
      style={slotStyle}
      data-search-auto-vertical-center={String(shell.autoVerticalCenter)}
      data-search-layout-ready={String(shell.layoutReady)}
      aria-label={shell.ariaLabel}
      ref={slotRef}
    >
      <div
        className={SEARCH_SHELL_CLASS}
        data-panel-open={view.panel.panelVisible ? 'true' : 'false'}
        onBlur={view.interactions.onRootBlur}
        onContextMenu={handleSearchContextMenu}
      >
        <form
          className={[
            SEARCH_FORM_CLASS,
            view.panel.panelVisible && SEARCH_FORM_PANEL_OPEN_CLASS
          ].filter(Boolean).join(' ')}
          style={formStyle}
          role="search"
          aria-label={shell.ariaLabel}
          onSubmit={view.interactions.onSubmit}
        >
          <Icon name="Search" className={SEARCH_ICON_CLASS} size={16} aria-hidden="true" />
          <SearchWidgetInput view={view} inputRef={inputRef} />
          <SearchWidgetClearButton view={view} />
          <SearchWidgetSeparator view={view} />
          <SearchWidgetNaturalButton view={view} />
          <DeferredSearchEngineMenu view={view} buttonRef={engineButtonRef} menuRef={engineMenuRef} />
          <SearchWidgetSubmitButton view={view} />
        </form>
        <SearchWidgetSuggestionsPanel view={view} />
      </div>
    </section>
  )
}

function SearchWidgetInput({
  inputRef,
  view
}: {
  inputRef: Ref<HTMLInputElement>
  view: NewtabSearchWidgetView
}) {
  const { combobox, interactions, shell } = view

  return (
    <Input
      className={SEARCH_INPUT_CLASS}
      type="search"
      autoComplete="off"
      enterKeyHint="search"
      placeholder={shell.placeholder}
      spellCheck={false}
      role="combobox"
      aria-label={shell.inputAriaLabel}
      aria-autocomplete="list"
      aria-controls="newtab-search-suggestions"
      aria-expanded={combobox.expanded}
      aria-activedescendant={combobox.activeDescendantId || undefined}
      onFocus={interactions.onInputFocus}
      onInput={interactions.onInputInput}
      onKeyDown={interactions.onInputKeyDown}
      ref={inputRef}
      unstyled
    />
  )
}

function SearchWidgetClearButton({ view }: { view: NewtabSearchWidgetView }) {
  const { hasInputValue } = view.action

  return (
    <Button
      className={SEARCH_CLEAR_BUTTON_CLASS}
      type="button"
      aria-label="清空搜索"
      hidden={!hasInputValue}
      onClick={view.interactions.onClear}
      unstyled
    >
      <Icon name="X" size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetSeparator({ view }: { view: NewtabSearchWidgetView }) {
  const { hasInputValue } = view.action

  return (
    <span
      className={SEARCH_SEPARATOR_CLASS}
      aria-hidden="true"
      hidden={!hasInputValue}
    />
  )
}

function SearchWidgetSubmitButton({ view }: { view: NewtabSearchWidgetView }) {
  const { canSubmit } = view.action

  return (
    <Button
      className={SEARCH_SUBMIT_BUTTON_CLASS}
      type="submit"
      aria-label="搜索网页"
      aria-disabled={!canSubmit}
      title="搜索网页"
      disabled={!canSubmit}
      unstyled
    >
      <Icon name="Search" className={SEARCH_SUBMIT_ICON_CLASS} size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetNaturalButton({ view }: { view: NewtabSearchWidgetView }) {
  const { natural } = view.buttons

  return (
    <Button
      className={getSearchNaturalButtonClass(natural)}
      type="button"
      aria-pressed={natural.active}
      aria-label={natural.ariaLabel}
      title={natural.title}
      onClick={view.interactions.onToggleNatural}
      unstyled
    >
      {natural.pending ? <span className={SEARCH_NATURAL_PENDING_DOT_CLASS} aria-hidden="true" /> : null}
      {natural.label}
    </Button>
  )
}

function SearchWidgetEngineButtonFallback({
  buttonRef,
  onRequest,
  view
}: {
  buttonRef: Ref<HTMLButtonElement>
  onRequest: () => void
  view: NewtabSearchWidgetView
}) {
  const { engine } = view.buttons

  return (
    <Button
      className={SEARCH_ENGINE_BUTTON_CLASS}
      type="button"
      aria-label={engine.ariaLabel}
      disabled={engine.disabled}
      title={engine.title}
      onMouseDown={(event) => {
        if (!engine.disabled) {
          event.preventDefault()
          onRequest()
          view.interactions.onEngineOpenChange(true)
        }
      }}
      onPointerEnter={() => {
        void loadNewtabSearchEngineMenu()
      }}
      onFocus={() => {
        void loadNewtabSearchEngineMenu()
      }}
      onClick={() => {
        if (!engine.disabled) {
          onRequest()
          view.interactions.onEngineOpenChange(true)
        }
      }}
      ref={buttonRef}
      unstyled
    >
      {engine.label}
      <Icon name="ChevronDown" className={SEARCH_ENGINE_CARET_CLASS} size={12} aria-hidden="true" />
    </Button>
  )
}

function DeferredSearchEngineMenu({
  buttonRef,
  menuRef,
  view
}: {
  buttonRef: RefObject<HTMLButtonElement | null>
  menuRef: Ref<HTMLDivElement>
  view: NewtabSearchWidgetView
}) {
  const [Menu, setMenu] = useState<NewtabSearchEngineMenuComponent | null>(
    newtabSearchEngineMenuComponent
  )

  const mountMenu = () => {
    void loadNewtabSearchEngineMenu().then((Component) => {
      setMenu(() => Component)
    })
  }

  useEffect(() => {
    if (Menu || !view.engineMenu.open) {
      return
    }
    let active = true
    void loadNewtabSearchEngineMenu().then((Component) => {
      if (active) {
        setMenu(() => Component)
      }
    })
    return () => {
      active = false
    }
  }, [Menu, view.engineMenu.open])

  return Menu ? (
    <Menu view={view} buttonRef={buttonRef} menuRef={menuRef} />
  ) : (
    <SearchWidgetEngineButtonFallback
      view={view}
      buttonRef={buttonRef}
      onRequest={mountMenu}
    />
  )
}

function SearchWidgetSuggestionsPanel({ view }: { view: NewtabSearchWidgetView }) {
  const { panel } = view

  return (
    <div
      id="newtab-search-suggestions-panel"
      className={SEARCH_PANEL_CLASS}
      hidden={!panel.panelVisible}
    >
      <div className={SEARCH_CHIPS_CLASS} aria-label="当前搜索条件">
        <SearchChips chips={view.chips} />
      </div>
      <div className={SEARCH_SECTION_LABEL_CLASS}>
        <SearchSectionLabel label={view.sectionLabel} />
      </div>
      <div
        id="newtab-search-suggestions"
        className={SEARCH_SUGGESTIONS_CLASS}
        aria-label="匹配的书签"
        hidden={!panel.suggestionsVisible}
      >
        <SearchSuggestions suggestions={view.suggestions} />
      </div>
      <output className={SEARCH_HINT_CLASS} aria-live="polite">
        <SearchHint state={view.hint} />
      </output>
    </div>
  )
}

function SearchChips({ chips }: { chips: SearchChipViewModel[] }) {
  if (!chips.length) {
    return null
  }

  return (
    <>
      {chips.map((chip) => (
        <span className={getSearchChipClass(chip.kind)} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </>
  )
}

function SearchSuggestions({ suggestions }: { suggestions: SearchSuggestionViewModel[] }) {
  return (
    <>
      {suggestions.map((suggestion) => (
        <Button
          id={suggestion.elementId}
          className={getSearchSuggestionClass({
            active: suggestion.active,
            command: Boolean(suggestion.command)
          })}
          type="button"
          aria-current={suggestion.active ? 'true' : undefined}
          aria-label={suggestion.ariaLabel}
          onPointerDown={(event) => {
            event.preventDefault()
          }}
          onClick={suggestion.onSelect}
          unstyled
          key={suggestion.id}
        >
          <span className={getSearchSuggestionMarkClass(Boolean(suggestion.command))} aria-hidden="true">
            {suggestion.mark}
          </span>
          <span className={SEARCH_SUGGESTION_COPY_CLASS}>
            <strong className={SEARCH_SUGGESTION_TITLE_CLASS}>{suggestion.title}</strong>
            <span className={SEARCH_SUGGESTION_META_CLASS}>{suggestion.meta}</span>
          </span>
        </Button>
      ))}
    </>
  )
}

function SearchSectionLabel({ label }: { label: string }) {
  return label ? <>{label}</> : null
}

function SearchHint({ state }: { state: SearchHintState }) {
  if (state.type === 'empty') {
    return null
  }

  if (state.type === 'webFallback') {
    return (
      <Button
        className={SEARCH_WEB_HINT_CLASS}
        type="button"
        title={state.title}
        aria-label={state.ariaLabel}
        onPointerDown={(event) => {
          event.preventDefault()
        }}
        onClick={state.onSelect}
        unstyled
      >
        {state.label}
      </Button>
    )
  }

  return <>{state.text}</>
}
