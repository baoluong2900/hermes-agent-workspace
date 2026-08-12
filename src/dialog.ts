type DialogLike = { close: () => void }
type DocumentLike = { getElementById: (id: string) => unknown }

export function closeDialogById(documentLike: DocumentLike, id: string): boolean {
  const dialog = documentLike.getElementById(id)
  if (!dialog || typeof (dialog as DialogLike).close !== 'function') return false
  ;(dialog as DialogLike).close()
  return true
}
