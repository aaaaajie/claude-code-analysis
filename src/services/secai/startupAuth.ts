import {
  DEFAULT_SECAI_GATEWAY_URL,
  DEFAULT_SECAI_MODEL,
  SecAIRequestError,
  appendSecAILog,
  applySecAIEnv,
  fetchBalance,
  loadSecAIConfig,
  loginWithPassword,
  normalizeGatewayURL,
  registerWithPhone,
  resetPasswordWithPhone,
  saveSecAIConfig,
  sendAuthCode,
  type SecAIConfig,
  type SecAILoginResponse,
} from './client.js'

const NO_AUTH_TOP_LEVEL_COMMANDS = new Set([
  'agents',
  'assistant',
  'auth',
  'auto-mode',
  'completion',
  'daemon',
  'doctor',
  'environment-runner',
  'error',
  'export',
  'help',
  'install',
  'log',
  'mcp',
  'open',
  'plugin',
  'plugins',
  'remote-control',
  'rollback',
  'self-hosted-runner',
  'server',
  'setup-token',
  'ssh',
  'task',
  'update',
  'upgrade',
  'up',
])

type AuthMode = 'password' | 'register' | 'reset'
type AuthFieldKey = 'phone' | 'code' | 'password' | 'confirmPassword'

type AuthTUIState = {
  mode: AuthMode
  focus: number
  phone: string
  code: string
  password: string
  confirmPassword: string
  loading: boolean
  status: string
  error: string
  authCodeCooldownPhone: string
  authCodeCooldownUntil: number
}

const AUTH_CODE_SEND_COOLDOWN_MS = 60_000

export async function ensureSecAIStartupAuth(args: string[]): Promise<void> {
  if (process.env.SECAI_DISABLED === '1' || !shouldRequireStartupAuth(args)) {
    return
  }

  const existing = await loadSecAIConfig()
  if (existing) {
    applySecAIEnv(await ensureCachedUserInfo(existing))
    return
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'SecAI 需要先登录账号。请在交互式终端启动一次 SecAI 完成登录后再运行当前命令。',
    )
  }

  const config = await promptForAuth()
  applySecAIEnv(config)
}

function shouldRequireStartupAuth(args: string[]): boolean {
  if (args.includes('--help') || args.includes('-h')) {
    return false
  }
  const firstArg = args[0]
  if (!firstArg || firstArg.startsWith('-')) {
    return true
  }
  return !NO_AUTH_TOP_LEVEL_COMMANDS.has(firstArg)
}

async function promptForAuth(): Promise<SecAIConfig> {
  appendSecAILog('startup_login_required')
  const baseURL = normalizeGatewayURL(
    process.env.SECAI_GATEWAY_URL || DEFAULT_SECAI_GATEWAY_URL,
  )
  return runAuthTUI(baseURL)
}

async function runAuthTUI(baseURL: string): Promise<SecAIConfig> {
  const stdin = process.stdin
  const stdout = process.stdout
  const wasRaw = stdin.isRaw
  const state: AuthTUIState = {
    mode: 'password',
    focus: 0,
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
    loading: false,
    status: '',
    error: '',
    authCodeCooldownPhone: '',
    authCodeCooldownUntil: 0,
  }

  return new Promise<SecAIConfig>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      stdin.off('data', onData)
      if (stdin.setRawMode) {
        stdin.setRawMode(wasRaw)
      }
      stdout.write('\x1b[?25h\x1b[2J\x1b[H')
    }

    const finish = (config: SecAIConfig) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(config)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    const render = () => {
      stdout.write('\x1b[?25l\x1b[2J\x1b[H')
      stdout.write(authTUIView(state))
    }

    const runOperation = async (operation: () => Promise<void>) => {
      if (state.loading) {
        return
      }
      state.loading = true
      state.error = ''
      render()
      try {
        await operation()
      } catch (error) {
        if (settled) {
          return
        }
        state.error =
          state.mode === 'password'
            ? formatLoginError(error)
            : formatAuthError(error)
        state.status = ''
        state.focus = loginErrorFieldPos(state.mode, state.error)
        appendSecAILog('startup_login_failed', {
          gateway_url: baseURL,
          status: error instanceof SecAIRequestError ? error.status : undefined,
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        if (!settled) {
          state.loading = false
          render()
        }
      }
    }

    const submit = async () => {
      const validation = validateLoginSubmit(state)
      if (validation) {
        state.error = validation
        state.status = ''
        state.focus = loginErrorFieldPos(state.mode, validation)
        render()
        return
      }

      if (state.mode === 'register') {
        state.status = '正在注册...'
        await runOperation(async () => {
          const response = await registerWithPhone({
            baseURL,
            phone: state.phone,
            password: state.password,
            code: state.code,
            name: 'secai-cli',
          })
          finish(await persistLogin(baseURL, response, state.phone))
        })
        return
      }

      if (state.mode === 'reset') {
        state.status = '正在重置密码...'
        await runOperation(async () => {
          const response = await resetPasswordWithPhone({
            baseURL,
            phone: state.phone,
            password: state.password,
            code: state.code,
            name: 'secai-cli',
          })
          finish(await persistLogin(baseURL, response, state.phone))
        })
        return
      }

      state.status = '正在登录...'
      await runOperation(async () => {
        const response = await loginWithPassword({
          baseURL,
          account: state.phone,
          password: state.password,
          name: 'secai-cli',
        })
        const config = await persistLogin(baseURL, response, state.phone)
        appendSecAILog('startup_login_success', {
          gateway_url: baseURL,
          user_id: response.user?.id,
        })
        finish(config)
      })
    }

    const sendCode = async () => {
      if (state.mode === 'password') {
        return
      }
      const phoneError = validateLoginPhone(state.phone, true)
      if (phoneError) {
        state.error = phoneError
        state.status = ''
        state.focus = 0
        render()
        return
      }
      const cooldown = remainingAuthCodeCooldownSeconds(state)
      if (cooldown > 0) {
        state.error = `验证码发送过于频繁，请 ${cooldown} 秒后再试。`
        state.status = ''
        render()
        return
      }
      state.status = '正在发送验证码...'
      await runOperation(async () => {
        const response = await sendAuthCode({
          baseURL,
          phone: state.phone,
          purpose: state.mode === 'reset' ? 'reset_password' : 'register',
        })
        state.authCodeCooldownPhone = state.phone.trim()
        state.authCodeCooldownUntil = Date.now() + AUTH_CODE_SEND_COOLDOWN_MS
        state.status = response.dev_code
          ? `验证码已发送：${response.dev_code}`
          : '验证码已发送。'
        state.focus = 1
      })
    }

    const setMode = (mode: AuthMode) => {
      state.mode = mode
      state.focus = 0
      state.error = ''
      state.status = ''
      render()
    }

    const moveFocus = (delta: number) => {
      const fields = loginFields(state.mode)
      state.focus = positiveMod(state.focus + delta, fields.length)
      render()
    }

    const handleText = (text: string) => {
      const field = currentField(state)
      state[field] += text
      syncLoginValidation(state)
      render()
    }

    const handleBackspace = () => {
      const field = currentField(state)
      state[field] = Array.from(state[field]).slice(0, -1).join('')
      syncLoginValidation(state)
      render()
    }

    const handleEnter = async () => {
      const fields = loginFields(state.mode)
      if (state.focus < fields.length - 1) {
        state.focus++
        render()
        return
      }
      await submit()
    }

    const handleKey = async (text: string) => {
      if (text === '\u0003') {
        fail(new Error('已取消登录。'))
        return
      }
      if (state.loading) {
        return
      }
      switch (text) {
        case '\u001b':
          if (state.mode === 'password') {
            fail(new Error('已取消登录。'))
          } else {
            setMode('password')
          }
          return
        case '\u0012':
          setMode('register')
          return
        case '\u0006':
          setMode('reset')
          return
        case '\u000c':
          setMode('password')
          return
        case '\u0013':
          await sendCode()
          return
        case '\t':
        case '\u001b[B':
          moveFocus(1)
          return
        case '\u001b[Z':
        case '\u001b[A':
          moveFocus(-1)
          return
        case '\r':
        case '\n':
          await handleEnter()
          return
        case '\u007f':
        case '\b':
          handleBackspace()
          return
      }

      for (const char of text) {
        const code = char.charCodeAt(0)
        if (char === '\u0003') {
          fail(new Error('已取消登录。'))
          return
        }
        if (state.loading) {
          return
        }
        if (char === '\u0012') {
          setMode('register')
          continue
        }
        if (char === '\u0006') {
          setMode('reset')
          continue
        }
        if (char === '\u000c') {
          setMode('password')
          continue
        }
        if (char === '\u0013') {
          await sendCode()
          continue
        }
        if (char === '\t') {
          moveFocus(1)
          continue
        }
        if (code === 13 || code === 10) {
          await handleEnter()
          continue
        }
        if (code === 127 || code === 8) {
          handleBackspace()
          continue
        }
        if (code >= 32 && code !== 127) {
          handleText(char)
        }
      }
    }

    const onData = (chunk: Buffer | string) => {
      void handleKey(chunk.toString('utf8'))
    }

    stdin.resume()
    if (stdin.setRawMode) {
      stdin.setRawMode(true)
    }
    stdin.on('data', onData)
    render()
  })
}

async function persistLogin(
  baseURL: string,
  response: SecAILoginResponse,
  account: string,
): Promise<SecAIConfig> {
  const savedConfig = await saveSecAIConfig({
    baseURL,
    apiKey: response.api_key,
    model: DEFAULT_SECAI_MODEL,
    user: response.user || userFromAccount(account),
    balance: response.balance,
  })
  await ensureCachedUserInfo(savedConfig)
  const config = await loadSecAIConfig()
  if (!config) {
    throw new Error('登录成功但本地缓存写入失败。')
  }
  return config
}

function userFromAccount(account: string) {
  return account.includes('@') ? { email: account } : { phone: account }
}

async function ensureCachedUserInfo(config: SecAIConfig): Promise<SecAIConfig> {
  if (config.user?.id || config.balance?.user_id) {
    return config
  }
  const balance = await fetchBalance(config)
  return saveSecAIConfig({
    baseURL: config.base_url,
    apiKey: config.api_key,
    model: config.model || DEFAULT_SECAI_MODEL,
    user: config.user,
    balance,
  })
}

function loginFields(mode: AuthMode): AuthFieldKey[] {
  if (mode === 'password') {
    return ['phone', 'password']
  }
  return ['phone', 'code', 'password', 'confirmPassword']
}

function currentField(state: AuthTUIState): AuthFieldKey {
  const fields = loginFields(state.mode)
  return fields[Math.min(state.focus, fields.length - 1)]
}

function syncLoginValidation(state: AuthTUIState): void {
  const phoneError = validateLoginPhone(state.phone, false)
  if (phoneError) {
    state.error = phoneError
    state.status = ''
    return
  }
  if (isLoginValidationError(state.error)) {
    state.error = ''
  }
  if (state.mode !== 'password') {
    const passwordError = validatePasswordLength(state.password, false)
    if (passwordError) {
      state.error = passwordError
      state.status = ''
      return
    }
    const confirmError = validatePasswordConfirmation(
      state.password,
      state.confirmPassword,
    )
    if (confirmError && state.confirmPassword.trim()) {
      state.error = confirmError
      state.status = ''
      return
    }
    if (isLoginValidationError(state.error)) {
      state.error = ''
    }
  }
}

function validateLoginSubmit(state: AuthTUIState): string {
  const phoneError = validateLoginPhone(state.phone, true)
  if (phoneError) {
    return phoneError
  }
  if (state.mode === 'password') {
    return state.password.trim() ? '' : '请输入密码。'
  }
  const passwordError = validatePasswordLength(state.password, true)
  if (passwordError) {
    return passwordError
  }
  if (!state.code.trim()) {
    return '请输入验证码。'
  }
  return validatePasswordConfirmation(state.password, state.confirmPassword)
}

function validateLoginPhone(phone: string, required: boolean): string {
  const value = phone.trim()
  if (!value) {
    return required ? '请输入手机号。' : ''
  }
  return /^1\d{10}$/.test(value) ? '' : '请输入正确的手机号。'
}

function validatePasswordLength(password: string, required: boolean): string {
  if (!password.trim()) {
    return required ? '请输入密码。' : ''
  }
  return password.length >= 6 ? '' : '密码至少需要 6 个字符。'
}

function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string {
  if (!confirmation.trim()) {
    return '请再次输入密码。'
  }
  return password === confirmation ? '' : '两次输入的密码不一致。'
}

function loginErrorFieldPos(mode: AuthMode, message: string): number {
  switch (message) {
    case '请输入验证码。':
    case '验证码错误或已过期，请重新发送。':
      return mode === 'password' ? 0 : 1
    case '请输入密码。':
    case '密码至少需要 6 个字符。':
      return mode === 'password' ? 1 : 2
    case '请再次输入密码。':
    case '两次输入的密码不一致。':
      return mode === 'password' ? 1 : 3
    default:
      return 0
  }
}

function isLoginValidationError(message: string): boolean {
  return [
    '请输入手机号。',
    '请输入正确的手机号。',
    '请输入密码。',
    '密码至少需要 6 个字符。',
    '请输入验证码。',
    '请再次输入密码。',
    '两次输入的密码不一致。',
  ].includes(message)
}

function remainingAuthCodeCooldownSeconds(state: AuthTUIState): number {
  if (state.authCodeCooldownPhone !== state.phone.trim()) {
    return 0
  }
  return Math.max(0, Math.ceil((state.authCodeCooldownUntil - Date.now()) / 1000))
}

function formatLoginError(error: unknown): string {
  if (error instanceof SecAIRequestError) {
    if (error.status === 401 || error.status === 403) {
      return '账号或密码错误。'
    }
    if (error.status === 429) {
      return error.retryAfter
        ? `请求过于频繁，请 ${error.retryAfter} 秒后再试。`
        : '请求过于频繁，请稍后再试。'
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function formatAuthError(error: unknown): string {
  if (error instanceof SecAIRequestError) {
    const message = error.message.toLowerCase()
    if (error.status === 404 && message.includes('phone is not registered')) {
      return '该手机号未注册，请先注册。'
    }
    if (error.status === 409 && message.includes('phone already registered')) {
      return '该手机号已注册，请直接登录或找回密码。'
    }
    if (error.status === 400 && message.includes('password')) {
      return '密码至少需要 6 个字符。'
    }
    if (error.status === 401 && message.includes('code')) {
      return '验证码错误或已过期，请重新发送。'
    }
    if (error.status === 429 && message.includes('verification code')) {
      return error.retryAfter
        ? `验证码发送过于频繁，请 ${error.retryAfter} 秒后再试。`
        : '验证码发送过于频繁，请稍后再试。'
    }
    if (error.status === 429) {
      return error.retryAfter
        ? `请求过于频繁，请 ${error.retryAfter} 秒后再试。`
        : '请求过于频繁，请稍后再试。'
    }
    return `请求失败（${error.status}）：${error.message}`
  }
  if (error instanceof Error && error.message.startsWith('SecAI 登录失败：')) {
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}

function authTUIView(state: AuthTUIState): string {
  const width = clamp((process.stdout.columns || 86) - 6, 58, 86)
  const contentWidth = width - 6
  const lines = [
    titleStyle('SecAI'),
    mutedStyle(loginModeTitle(state.mode)),
    '',
    ...authFieldRows(state),
    '',
    ...authStatusLines(state, contentWidth),
  ]
  return `\n${renderPanel(lines, width)}\n`
}

function authFieldRows(state: AuthTUIState): string[] {
  const fields = loginFields(state.mode)
  const rows: string[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    const active = index === state.focus
    rows.push(fieldLabel(fieldTitle(field, state.mode), active))
    rows.push(fieldValue(state, field, active))
  }
  return rows
}

function authStatusLines(state: AuthTUIState, width: number): string[] {
  if (state.loading) {
    return wrapText(state.status || '处理中...', width).map(accentStyle)
  }
  if (state.error) {
    return wrapText(state.error, width).map(errorStyle)
  }
  if (state.status) {
    return wrapText(state.status, width).map(mutedStyle)
  }
  return loginShortcutHint(state.mode).map(mutedStyle)
}

function fieldTitle(field: AuthFieldKey, mode: AuthMode): string {
  switch (field) {
    case 'phone':
      return '手机号'
    case 'code':
      return '验证码'
    case 'confirmPassword':
      return '确认密码'
    case 'password':
      return mode === 'reset' ? '新密码' : '密码'
  }
}

function fieldValue(
  state: AuthTUIState,
  field: AuthFieldKey,
  active: boolean,
): string {
  const rawValue = state[field]
  const value =
    field === 'password' || field === 'confirmPassword'
      ? '*'.repeat(Array.from(rawValue).length)
      : rawValue
  const placeholder = fieldPlaceholder(field, state.mode)
  const body = value
    ? `${value}${active && !state.loading ? '█' : ''}`
    : active && !state.loading
      ? `█ ${placeholder}`
      : placeholder
  const styled = value || active ? accentStyle(body) : mutedStyle(body)
  return `  ${styled}`
}

function fieldPlaceholder(field: AuthFieldKey, mode: AuthMode): string {
  switch (field) {
    case 'phone':
      return '输入手机号'
    case 'code':
      return '输入验证码'
    case 'confirmPassword':
      return '再次输入密码'
    case 'password':
      return mode === 'reset' ? '输入新密码' : '输入密码'
  }
}

function fieldLabel(label: string, active: boolean): string {
  return active ? accentStyle(`› ${label}`) : mutedStyle(`  ${label}`)
}

function loginModeTitle(mode: AuthMode): string {
  switch (mode) {
    case 'register':
      return '手机号验证码注册'
    case 'reset':
      return '手机号验证码找回密码'
    default:
      return '手机号密码登录'
  }
}

function loginShortcutHint(mode: AuthMode): string[] {
  const sendCodeHint =
    mode === 'password' ? '' : ' · Control+S 发送验证码'
  if (process.platform === 'darwin') {
    return [
      'Tab/↑/↓ 切换输入框 · Enter 提交 · Esc 返回/退出',
      `Control+R 注册 · Control+F 找回密码${sendCodeHint}`,
    ]
  }
  const nonDarwinSendCodeHint = mode === 'password' ? '' : ' · Ctrl+S 发送验证码'
  return [
    'Tab/↑/↓ 切换输入框 · Enter 提交 · Esc 返回/退出',
    `Ctrl+R 注册 · Ctrl+F 找回密码${nonDarwinSendCodeHint}`,
  ]
}

function renderPanel(lines: string[], width: number): string {
  const innerWidth = width - 6
  const top = borderStyle(`╭${'─'.repeat(width - 2)}╮`)
  const bottom = borderStyle(`╰${'─'.repeat(width - 2)}╯`)
  const body = lines.map((line) => {
    const padded = `${line}${' '.repeat(Math.max(0, innerWidth - displayWidth(line)))}`
    return `${borderStyle('│')}  ${padded}  ${borderStyle('│')}`
  })
  return [top, ...body, bottom].join('\n')
}

function titleStyle(value: string): string {
  return `\x1b[1m\x1b[38;5;15m\x1b[48;5;62m ${value} \x1b[0m`
}

function accentStyle(value: string): string {
  return `\x1b[38;5;69m${value}\x1b[0m`
}

function mutedStyle(value: string): string {
  return `\x1b[38;5;245m${value}\x1b[0m`
}

function errorStyle(value: string): string {
  return `\x1b[38;5;196m${value}\x1b[0m`
}

function borderStyle(value: string): string {
  return `\x1b[38;5;62m${value}\x1b[0m`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function wrapText(value: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of value) {
    if (displayWidth(line + char) > width && line) {
      lines.push(line)
      line = char
      continue
    }
    line += char
  }
  lines.push(line)
  return lines
}

function displayWidth(value: string): number {
  let width = 0
  for (const char of stripAnsi(value)) {
    width += charWidth(char.codePointAt(0) || 0)
  }
  return width
}

function charWidth(code: number): number {
  if (code === 0) {
    return 0
  }
  if (code < 32 || (code >= 0x7f && code < 0xa0)) {
    return 0
  }
  if (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  ) {
    return 0
  }
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2329 && code <= 0x232a) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2
  }
  return 1
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, '')
}
