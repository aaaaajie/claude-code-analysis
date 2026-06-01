import * as React from 'react'
import stripAnsi from 'strip-ansi'
import { Box, RawAnsi, Text } from '../../ink.js'
import { stringWidth } from '../../ink/stringWidth.js'
import logoAnsi from './logo.ans'

type LogoData = {
  lines: string[]
  width: number
}

const logoData = loadSecAILogo()

export function SecAILogo(): React.ReactNode {
  return (
    <Box flexDirection="column">
      {logoData.lines.length > 0 ? (
        <RawAnsi lines={logoData.lines} width={logoData.width} />
      ) : (
        <Text color="cyan">SecAI</Text>
      )}
    </Box>
  )
}

function loadSecAILogo(): LogoData {
  const lines = logoAnsi.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
  const width = Math.max(1, ...lines.map(line => stringWidth(stripAnsi(line))))
  return { lines, width }
}
