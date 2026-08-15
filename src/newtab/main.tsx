import { prefetchNewtabStartupData } from './newtab-startup-data'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './newtab.css'
import { initSquircleEngine } from '../shared/squircle-engine'
import { NewtabApp } from './NewtabApp'

const root = document.getElementById('newtab-react-root')

if (!root) {
  throw new Error('Missing newtab React root')
}

// Request the controller chunk before anything else on this module runs. It is
// the module that renders the live bookmark grid, and its download plus its
// off-thread parse are the longest single hop left in startup. Kicking it off
// here overlaps that hop with the React mount below instead of queueing it
// after — the chunk is typically compiled by the time React has committed.
const newTabControllerModule = import('./newtab-controller')

prefetchNewtabStartupData()
markNewTabStartupBaseline()
initSquircleEngine()
createRoot(root).render(<NewtabApp />)
scheduleNewTabControllerStart()

function markNewTabStartupBaseline(): void {
  try {
    performance.mark('newtab.domContentLoaded')
  } catch {
    // Performance marks are diagnostics only and must never block startup.
  }
}

function scheduleNewTabControllerStart(): void {
  void newTabControllerModule
    .then(({ startNewTabController }) => {
      // React's first commit is already queued by the render() call above, and
      // this timer is only queued once the chunk resolves, so the shell still
      // paints before the controller takes the main thread. A frame-aligned
      // wait would instead idle until the next vsync for no benefit.
      window.setTimeout(startNewTabController, 0)
    })
    .catch((error) => {
      console.error('新标签页控制器加载失败。', error)
    })
}
