import {useLayoutEffect, useState} from 'react'
import type {LayoutProps} from 'sanity'
import {installUploadGuard} from './upload-limits'

export function UploadLimitLayout(props: LayoutProps) {
  const [error, setError] = useState<string>()
  useLayoutEffect(() => installUploadGuard(window, setError), [])

  return (
    <>
      {props.renderDefault(props)}
      {error && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2147483647,
            maxWidth: 440,
            maxHeight: '50vh',
            overflow: 'auto',
            padding: 20,
            marginLeft: 24,
            borderRadius: 8,
            background: '#fff0f0',
            color: '#801b1b',
            boxShadow: '0 4px 24px #0003',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>Không thể upload file</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setError(undefined)}>
            Đóng
          </button>
        </div>
      )}
    </>
  )
}
