#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

const GATEWAYS = {
  prod: 'https://ai.rzsec.cn',
}

const action = process.argv[2] || 'status'
const configPath = join(homedir(), '.secai', 'config.json')

function normalizeURL(value) {
  const trimmed = String(value || '').trim()
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

async function readConfig() {
  if (!existsSync(configPath)) return null
  return JSON.parse(await readFile(configPath, 'utf8'))
}

function masked(value) {
  if (!value) return '未配置'
  if (value.length <= 10) return '***'
  return `${value.slice(0, 5)}...${value.slice(-4)}`
}

async function writeConfig(config) {
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 })
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })
  await chmod(configPath, 0o600)
}

function printStatus(config) {
  console.log(`配置路径: ${configPath}`)
  if (!config) {
    console.log('状态: 未登录')
    return
  }
  console.log(`网关: ${config.base_url || '未配置'}`)
  console.log(`模型: ${config.model || 'sec-lab-lite'}`)
  console.log(`API key: ${masked(config.api_key)}`)
}

async function main() {
  if (action === 'status') {
    printStatus(await readConfig())
    return
  }

  const target = GATEWAYS[action]
  if (!target) {
    console.error('用法: npm run gateway:status | gateway:prod')
    process.exitCode = 1
    return
  }

  const config = await readConfig()
  if (!config?.api_key) {
    console.error(`未找到 SecAI 登录配置，请先登录后再切换网关: ${configPath}`)
    process.exitCode = 1
    return
  }

  const next = {
    ...config,
    base_url: normalizeURL(target),
    updated_at: new Date().toISOString(),
  }
  await writeConfig(next)
  printStatus(next)
}

await main()
