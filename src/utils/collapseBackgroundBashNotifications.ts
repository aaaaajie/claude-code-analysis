import {
  STATUS_TAG,
  SUMMARY_TAG,
  TASK_NOTIFICATION_TAG,
} from '../constants/xml.js'
import { BACKGROUND_BASH_SUMMARY_PREFIX } from '../tasks/LocalShellTask/LocalShellTask.js'
import type {
  NormalizedUserMessage,
  RenderableMessage,
} from '../types/message.js'
import { isFullscreenEnvEnabled } from './fullscreen.js'
import { extractTag } from './messages.js'

const LEGACY_BACKGROUND_BASH_SUMMARY_PREFIX = 'Background command '

export function isCompletedBackgroundBashNotificationText(text: string): boolean {
  if (!text.includes(`<${TASK_NOTIFICATION_TAG}`)) return false
  if (extractTag(text, STATUS_TAG) !== 'completed') return false
  const summary = extractTag(text, SUMMARY_TAG)
  return (
    summary?.startsWith(BACKGROUND_BASH_SUMMARY_PREFIX) === true ||
    summary?.startsWith(LEGACY_BACKGROUND_BASH_SUMMARY_PREFIX) === true
  )
}

function isCompletedBackgroundBash(
  msg: RenderableMessage,
): msg is NormalizedUserMessage {
  if (msg.type !== 'user') return false
  const content = msg.message.content[0]
  if (content?.type !== 'text') return false
  return isCompletedBackgroundBashNotificationText(content.text)
}

/**
 * Collapses consecutive completed-background-bash task-notifications into a
 * single synthetic "N background commands completed" notification. Failed/killed
 * tasks and agent/workflow notifications are left alone. Monitor stream
 * events (enqueueStreamEvent) have no <status> tag and never match.
 *
 * Pass-through in verbose mode so ctrl+O shows each completion.
 */
export function collapseBackgroundBashNotifications(
  messages: RenderableMessage[],
  verbose: boolean,
): RenderableMessage[] {
  if (!isFullscreenEnvEnabled()) return messages
  if (verbose) return messages

  const result: RenderableMessage[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!
    if (isCompletedBackgroundBash(msg)) {
      let count = 0
      while (i < messages.length && isCompletedBackgroundBash(messages[i]!)) {
        count++
        i++
      }
      if (count === 1) {
        result.push(msg)
      } else {
        // Synthesize a task-notification that UserAgentNotificationMessage
        // already knows how to render — no new renderer needed.
        result.push({
          ...msg,
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `<${TASK_NOTIFICATION_TAG}><${STATUS_TAG}>completed</${STATUS_TAG}><${SUMMARY_TAG}>已完成 ${count} 个后台命令</${SUMMARY_TAG}></${TASK_NOTIFICATION_TAG}>`,
              },
            ],
          },
        })
      }
    } else {
      result.push(msg)
      i++
    }
  }

  return result
}
