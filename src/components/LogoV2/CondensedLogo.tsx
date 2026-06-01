import * as React from 'react'
import { Box } from '../../ink.js'
import { OffscreenFreeze } from '../OffscreenFreeze.js'
import { SecAILogo } from './SecAILogo.js'

export function CondensedLogo(): React.ReactNode {
  return (
    <OffscreenFreeze>
      <Box paddingLeft={2}>
        <SecAILogo />
      </Box>
    </OffscreenFreeze>
  )
}
