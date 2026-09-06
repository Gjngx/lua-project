// Decimal MB, matching the limits shown to editors (1 MB = 1,000,000 bytes).
const MB = 1_000_000
type UploadFile = Pick<File, 'name' | 'type' | 'size'>

export function getUploadLimit(file: UploadFile) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mime = file.type.toLowerCase()
  // Check both MIME and extension; apply the strictest matching limit.
  const limits: number[] = []
  if (
    mime.startsWith('image/') ||
    /^(avif|bmp|gif|heic|heif|ico|jfif|jpeg|jpg|png|svg|tif|tiff|webp)$/.test(extension || '')
  )
    limits.push(2)
  if (mime === 'model/gltf-binary' || extension === 'glb') limits.push(5)
  if (
    mime.startsWith('video/') ||
    mime === 'audio/mpeg' ||
    mime === 'audio/mp3' ||
    /^(mp3|mp4|m4v|mov|webm|avi|mkv|mpeg|mpg|ogv|3gp|3g2|wmv|flv|ts|mts|m2ts)$/.test(
      extension || '',
    )
  )
    limits.push(10)
  return limits.length ? Math.min(...limits) * MB : undefined
}

export function getUploadError(files: Iterable<UploadFile>): string | undefined {
  const errors = Array.from(files).flatMap((file) => {
    const limit = getUploadLimit(file)
    return limit !== undefined && file.size > limit
      ? [`“${file.name}” vượt giới hạn ${limit / MB} MB.`]
      : []
  })
  return errors.length ? `${errors.join(' ')} Vui lòng chọn lại file nhỏ hơn.` : undefined
}

export function installUploadGuard(target: Window, onError: (message: string) => void) {
  const guard = (event: Event) => {
    let files: FileList | null | undefined
    let input: HTMLInputElement | undefined
    if (event.type === 'change' || event.type === 'input') {
      const element = event.target as HTMLInputElement | null
      if (element?.tagName !== 'INPUT' || element.type !== 'file') return
      input = element
      files = element.files
    } else if (event.type === 'drop') {
      files = (event as DragEvent).dataTransfer?.files
    } else {
      files = (event as ClipboardEvent).clipboardData?.files
    }
    const error = files && getUploadError(Array.from(files))
    if (!error) return
    // Capture on window before Sanity's React handlers, including portal dialogs,
    // array/Portable Text drop targets, and clipboard uploads.
    event.preventDefault()
    event.stopImmediatePropagation()
    if (input) input.value = ''
    onError(error)
  }
  const events = ['input', 'change', 'drop', 'paste']
  events.forEach((event) => target.addEventListener(event, guard, true))
  return () => events.forEach((event) => target.removeEventListener(event, guard, true))
}
