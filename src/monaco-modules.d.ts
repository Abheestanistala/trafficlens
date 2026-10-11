declare module 'monaco-editor/editor/editor.api.js' {
  export * from 'monaco-editor'
}
declare module 'monaco-editor/*.js'
declare module 'monaco-editor/*?worker' {
  const W: new () => Worker
  export default W
}
