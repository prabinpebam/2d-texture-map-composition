import { useEffect, useId, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { NodeCatalogItem } from '../domain/workspace'
import { IconButton } from './IconButton'

interface NodeSearchDialogProps {
  items: readonly NodeCatalogItem[]
  onChoose(type: string): void
  onClose(): void
}

export function NodeSearchDialog({
  items,
  onChoose,
  onClose,
}: NodeSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = items.filter((item) =>
    `${item.label} ${item.category} ${item.summary}`
      .toLowerCase()
      .includes(normalizedQuery),
  )
  const boundedActiveIndex = Math.min(
    activeIndex,
    Math.max(0, filteredItems.length - 1),
  )
  const activeItem = filteredItems[boundedActiveIndex]

  useEffect(() => {
    inputRef.current?.focus()
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="dialog-scrim node-search-scrim">
      <section
        aria-labelledby="node-search-title"
        aria-modal="true"
        className="node-search-dialog"
        role="dialog"
      >
        <div className="node-search-header">
          <h2 id="node-search-title">Add node</h2>
          <IconButton label="Close Add node" onClick={onClose}>
            <X aria-hidden="true" size={16} />
          </IconButton>
        </div>
        <div className="node-search-input-wrap">
          <Search aria-hidden="true" size={16} />
          <input
            aria-activedescendant={
              activeItem ? `${listId}-${activeItem.id}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded="true"
            aria-label="Search node types"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (filteredItems.length === 0) return
                const direction = event.key === 'ArrowDown' ? 1 : -1
                setActiveIndex(
                  (boundedActiveIndex + direction + filteredItems.length) %
                    filteredItems.length,
                )
              } else if (event.key === 'Enter' && activeItem) {
                event.preventDefault()
                onChoose(activeItem.id)
              }
            }}
            placeholder="Search nodes"
            ref={inputRef}
            role="combobox"
            value={query}
          />
        </div>
        <div
          aria-label="Node types"
          className="node-search-results"
          id={listId}
          role="listbox"
        >
          {filteredItems.length === 0 ? (
            <p className="node-search-empty" role="status">
              No matching nodes
            </p>
          ) : (
            filteredItems.map((item, index) => (
              <button
                aria-selected={index === boundedActiveIndex}
                className="node-search-option"
                id={`${listId}-${item.id}`}
                key={item.id}
                onClick={() => onChoose(item.id)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.summary}</small>
                </span>
                <span className="node-search-category">{item.category}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
