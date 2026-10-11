// Lean Monaco build: core API + only the features/languages a read-only viewer needs (avoids the 7 MB TS worker).
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/editor/contrib/find/browser/findController.js'
import 'monaco-editor/editor/contrib/folding/browser/folding.js'
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js'
import 'monaco-editor/basic-languages/monaco.contribution.js'
import 'monaco-editor/language/json/monaco.contribution.js'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import Editor, { loader } from '@monaco-editor/react'

// Bundle Monaco locally: the default loader pulls from a CDN, which would leak traffic and break the CSP.
self.MonacoEnvironment = { getWorker: (_id: string, label: string) => (label === 'json' ? new JsonWorker() : new EditorWorker()) }
loader.config({ monaco })

export default function MonacoView({ value, language }: { value: string; language: string }) {
  return (
    <Editor
      value={value}
      language={language}
      theme={document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark'}
      options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false, fontSize: 12 }}
    />
  )
}
