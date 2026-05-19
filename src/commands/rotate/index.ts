const rotate: import('../../types/command.js').Command = {
  type: 'local-jsx',
  name: 'rotate',
  description: 'Ping all providers, select provider or build failover chain',
  load: () => import('./rotate.js'),
}

export default rotate
