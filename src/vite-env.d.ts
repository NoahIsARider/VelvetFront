/// <reference types="vite/client" />

interface Window {
  desktop?: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
  }
}
