import './MonacoView' // side effects: local Monaco + workers
import { DiffEditor } from '@monaco-editor/react'

export default function MonacoDiff({ original, modified, language }: { original: string; modified: string; language: string }) {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme={document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark'}
      options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false, fontSize: 12, originalEditable: false }}
    />
  )
}
