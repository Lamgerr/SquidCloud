import { useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { nord } from '@milkdown/theme-nord'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'

interface MilkdownEditorProps {
  value: string
  onChange?: (value: string) => void
  className?: string
}

export default function MilkdownEditor({ value, onChange, className }: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, containerRef.current!)
        ctx.set(defaultValueCtx, value)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current?.(markdown)
        })
      })
      .use(nord)
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)

    editor.create().then(() => {
      editorRef.current = editor
    })

    return () => {
      editor.destroy()
      editorRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'auto' }}
    />
  )
}
