/**
 * /proactive — Toggle proactive (autonomous) mode on/off.
 */

import type { Command, CommandResultDisplay } from '../commands.js'

const proactive: Command = {
  name: 'proactive',
  description: 'Toggle proactive mode (autonomous ticks)',
  isEnabled: () => true,
  isHidden: false,
  userFacingName: () => 'proactive',
  call: async (_args, _context, onDone) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const mod = require('../proactive/index.js') as typeof import('../proactive/index.js')
    /* eslint-enable @typescript-eslint/no-require-imports */

    if (mod.isProactiveActive()) {
      mod.deactivateProactive()
      onDone('Proactive mode **off** — waiting for your input.', {
        display: 'inline' as CommandResultDisplay,
      })
    } else {
      mod.activateProactive('command')
      onDone('Proactive mode **on** — JARVIS will act autonomously between turns.', {
        display: 'inline' as CommandResultDisplay,
      })
    }
  },
}

export default proactive
