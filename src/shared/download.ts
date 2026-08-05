function downloadBlob(filename: string, blob: Blob): void {
  if (typeof document === 'undefined') {
    throw new Error('Download is unavailable.')
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  try {
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  downloadBlob(filename, blob)
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    })
  )
}
