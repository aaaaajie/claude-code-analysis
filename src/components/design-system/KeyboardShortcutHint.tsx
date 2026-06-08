import { c as _c } from "react/compiler-runtime";
import React from 'react';
import Text from '../../ink/components/Text.js';
type Props = {
  /** The key or chord to display (e.g., "ctrl+o", "Enter", "↑/↓") */
  shortcut: string;
  /** The action the key performs (e.g., "expand", "select", "navigate") */
  action: string;
  /** Whether to wrap the hint in parentheses. Default: false */
  parens?: boolean;
  /** Whether to render the shortcut in bold. Default: false */
  bold?: boolean;
};

/**
 * Renders a keyboard shortcut hint like "ctrl+o to expand" or "(tab to toggle)"
 *
 * Wrap in <Text dimColor> for the common dim styling.
 *
 * @example
 * // Simple hint wrapped in dim Text
 * <Text dimColor><KeyboardShortcutHint shortcut="esc" action="cancel" /></Text>
 *
 * // With parentheses: "(ctrl+o to expand)"
 * <Text dimColor><KeyboardShortcutHint shortcut="ctrl+o" action="expand" parens /></Text>
 *
 * // With bold shortcut: "Enter to confirm" (Enter is bold)
 * <Text dimColor><KeyboardShortcutHint shortcut="Enter" action="confirm" bold /></Text>
 *
 * // Multiple hints with middot separator - use Byline
 * <Text dimColor>
 *   <Byline>
 *     <KeyboardShortcutHint shortcut="Enter" action="confirm" />
 *     <KeyboardShortcutHint shortcut="Esc" action="cancel" />
 *   </Byline>
 * </Text>
 */
export function KeyboardShortcutHint(t0) {
  const $ = _c(9);
  const {
    shortcut,
    action,
    parens: t1,
    bold: t2
  } = t0;
  const parens = t1 === undefined ? false : t1;
  const bold = t2 === undefined ? false : t2;
  let t3;
  if ($[0] !== bold || $[1] !== shortcut) {
    t3 = bold ? <Text bold={true}>{shortcut}</Text> : shortcut;
    $[0] = bold;
    $[1] = shortcut;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  const shortcutText = t3;
  const actionText = getShortcutActionLabel(action);
  if (parens) {
    let t4;
    if ($[3] !== actionText || $[4] !== shortcutText) {
      t4 = <Text>({shortcutText} {actionText})</Text>;
      $[3] = actionText;
      $[4] = shortcutText;
      $[5] = t4;
    } else {
      t4 = $[5];
    }
    return t4;
  }
  let t4;
  if ($[6] !== actionText || $[7] !== shortcutText) {
    t4 = <Text>{shortcutText} {actionText}</Text>;
    $[6] = actionText;
    $[7] = shortcutText;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}

function getShortcutActionLabel(action: string): string {
  switch (action) {
    case 'expand':
      return '展开'
    case 'cancel':
      return '取消'
    case 'details':
      return '查看详情'
    case 'dismiss':
      return '关闭'
    case 'close':
      return '关闭'
    case 'confirm':
      return '确认'
    case 'copy':
      return '复制'
    case 'cycle':
      return '切换'
    case 'edit':
      return '编辑'
    case 'hide':
      return '隐藏'
    case 'hide tasks':
      return '隐藏任务'
    case 'interrupt':
      return '中断'
    case 'manage':
      return '管理'
    case 'native select':
      return '原生选择'
    case 'navigate':
      return '导航'
    case 'next':
      return '下一个'
    case 'prev':
      return '上一个'
    case 'previous':
      return '上一个'
    case 'remove':
      return '移除'
    case 'resolve':
      return '处理'
    case 'return to team lead':
      return '返回主会话'
    case 'select':
      return '选择'
    case 'go back':
      return '返回'
    case 'apply':
      return '应用'
    case 'apply changes':
      return '应用更改'
    case 'auth':
      return '认证'
    case 'authenticate':
      return '认证'
    case 'show tasks':
      return '显示任务'
    case 'show teammates':
      return '显示智能体'
    case 'stop agents':
      return '停止智能体'
    case 'update':
      return '更新'
    case 'view tasks':
      return '查看任务'
    case 'view':
      return '查看'
    case 'foreground':
      return '切到前台'
    case 'stop':
      return '停止'
    case 'stop all agents':
      return '停止所有智能体'
    case 'toggle selection':
      return '切换选择'
    case 'toggle':
      return '切换'
    case 'enter text':
      return '输入文本'
    case 'continue':
      return '继续'
    case 'open in editor':
      return '在编辑器中打开'
    case 'exit':
      return '退出'
    case 'teleport':
      return '接管'
    case 'write to file':
      return '写入文件'
    default:
      return action
  }
}
