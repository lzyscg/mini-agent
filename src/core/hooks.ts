/**
 * Simple hook event system for mini-agent plugins.
 *
 * Three event points:
 * - session_start:     Fired when a new conversation turn begins
 * - before_tool_call:  Fired before a tool executes (can abort)
 * - after_tool_call:   Fired after a tool executes (can inspect result)
 */

export interface SessionStartContext {
  sessionId: string
  resuming: boolean
}

export interface BeforeToolCallContext {
  toolName: string
  args: Record<string, unknown>
  /** Set to true inside hook to prevent the tool from executing */
  aborted: boolean
  /** Reason for aborting (shown as tool result) */
  abortReason?: string
}

export interface AfterToolCallContext {
  toolName: string
  args: Record<string, unknown>
  result: string
  durationMs: number
}

export type HookContext =
  | { event: 'session_start'; data: SessionStartContext }
  | { event: 'before_tool_call'; data: BeforeToolCallContext }
  | { event: 'after_tool_call'; data: AfterToolCallContext }

export type HookEvent = HookContext['event']

export type HookFn = (ctx: HookContext) => Promise<void>

/**
 * Central hook registry. Plugins register hooks here at load time.
 */
class HookBus {
  private listeners = new Map<HookEvent, HookFn[]>()

  register(event: HookEvent, fn: HookFn): void {
    const list = this.listeners.get(event) ?? []
    list.push(fn)
    this.listeners.set(event, list)
  }

  async emit(ctx: HookContext): Promise<void> {
    const fns = this.listeners.get(ctx.event) ?? []
    for (const fn of fns) {
      try {
        await fn(ctx)
      } catch (err) {
        console.warn(`[hooks] Error in ${ctx.event} hook: ${(err as Error).message}`)
      }
    }
  }

  get count(): number {
    let total = 0
    for (const fns of this.listeners.values()) {
      total += fns.length
    }
    return total
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const hookBus = new HookBus()
