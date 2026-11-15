export async function copyToClipboard(field: HTMLInputElement | HTMLTextAreaElement) {
  const clipboard = field.ownerDocument.defaultView?.navigator.clipboard;
  if (clipboard) {
    try {
      await clipboard.writeText(field.value);
      return true;
    } catch {
      // Keep manual copying available if the browser denies clipboard access.
    }
  }
  field.focus();
  field.select();
  return false;
}
