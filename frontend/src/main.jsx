import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { disableHoverEffects } from './utils/animationToggle'

// Disable hover/animation effects by default across the app.
// You can enable them later by calling `enableHoverEffects()` from
// the browser console or by importing the helper.
disableHoverEffects()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
