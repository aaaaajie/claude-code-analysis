export function dlopen(): never {
  throw new Error('bun:ffi is unavailable in the Node runtime build')
}
