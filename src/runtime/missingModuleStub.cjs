const unavailable = () => {
  throw new Error('This Claude Code internal module is unavailable in this reconstructed runtime build')
}

module.exports = new Proxy(
  {
    default: {},
    WORKFLOW_TOOL_NAME: 'Workflow',
    TungstenTool: {
      name: 'Tungsten',
      async call() {
        return unavailable()
      },
    },
    TungstenLiveMonitor: () => null,
    isConnectorTextBlock: () => false,
    checkProtectedNamespace: () => false,
    getStats: () => ({
      collapsedSpans: 0,
      stagedSpans: 0,
      health: {
        totalErrors: 0,
        totalEmptySpawns: 0,
        emptySpawnWarningEmitted: false,
      },
    }),
    subscribe: () => () => {},
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop]
      return unavailable
    },
  },
)
