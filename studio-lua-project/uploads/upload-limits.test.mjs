import assert from 'node:assert/strict'
import {test} from 'node:test'
import {getUploadError, getUploadLimit, installUploadGuard} from './upload-limits.ts'

const file = (name, type, size) => ({name, type, size})

test('image, video, MP3 and GLB limits allow the boundary and reject one byte over', () => {
  for (const [name, type, limit] of [
    ['photo.png', 'image/png', 2_000_000],
    ['PHOTO.JPG', '', 2_000_000],
    ['clipboard', 'image/webp', 2_000_000],
    ['movie.mp4', 'video/mp4', 10_000_000],
    ['MOVIE.MOV', '', 10_000_000],
    ['track.mp3', 'audio/mpeg', 10_000_000],
    ['TRACK.MP3', '', 10_000_000],
    ['model.glb', 'application/octet-stream', 5_000_000],
    ['MODEL.GLB', '', 5_000_000],
  ]) {
    assert.equal(getUploadLimit(file(name, type, 0)), limit)
    assert.equal(getUploadError([file(name, type, limit)]), undefined)
    assert.match(getUploadError([file(name, type, limit + 1)]), /vượt giới hạn/)
  }
})

test('mixed selections report oversized files; conflicting MIME uses the stricter limit', () => {
  const error = getUploadError([
    file('valid.png', 'image/png', 10),
    file('large.jpg', '', 2_000_001),
    file('large.glb', '', 5_000_001),
  ])
  assert.ok(!error.includes('valid.png'))
  assert.match(error, /large.jpg/)
  assert.match(error, /large.glb/)
  assert.equal(getUploadLimit(file('photo.mp4', 'image/png', 0)), 2_000_000)
  assert.equal(getUploadError([file('notes.pdf', 'application/pdf', 20_000_000)]), undefined)
})

// Simulate the native event boundary without depending on React or a live dataset.
function harness() {
  const listeners = new Map()
  const errors = []
  const target = {
    addEventListener(type, handler, capture) {
      assert.equal(capture, true)
      listeners.set(type, handler)
    },
    removeEventListener(type, handler, capture) {
      assert.equal(capture, true)
      assert.equal(listeners.get(type), handler)
      listeners.delete(type)
    },
  }
  const cleanup = installUploadGuard(target, (error) => errors.push(error))
  function dispatch(type, files) {
    let blocked = false
    let prevented = false
    const input = {tagName: 'INPUT', type: 'file', files, value: 'selected-file'}
    listeners.get(type)?.({
      type,
      target: input,
      dataTransfer: {files},
      clipboardData: {files},
      preventDefault() {
        prevented = true
      },
      stopImmediatePropagation() {
        blocked = true
      },
    })
    return {blocked, prevented, input}
  }
  return {dispatch, errors, cleanup, listeners}
}

test('file picker, drop and paste are stopped before upload handlers; valid files pass', () => {
  const {dispatch, errors, cleanup, listeners} = harness()
  for (const type of ['input', 'change', 'drop', 'paste']) {
    const result = dispatch(type, [file('large.png', 'image/png', 2_000_001)])
    assert.equal(result.blocked, true)
    assert.equal(result.prevented, true)
    if (type === 'input' || type === 'change') assert.equal(result.input.value, '')
    assert.equal(dispatch(type, [file('small.png', 'image/png', 2_000_000)]).blocked, false)
    assert.equal(dispatch(type, []).blocked, false)
  }
  assert.equal(errors.length, 4)
  cleanup()
  assert.equal(listeners.size, 0)
})
