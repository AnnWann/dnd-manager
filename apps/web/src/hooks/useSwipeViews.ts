import { useMemo, useRef, useState } from 'react'

export type UseSwipeViewsOptions = {
  viewCount: number
  initialIndex?: number

  /** Prefer horizontal swipe if abs(dx) > abs(dy) * ratio. */
  axisLockRatio?: number

  /** Minimum pixels to consider it a swipe. */
  minThresholdPx?: number

  /** Maximum pixels to consider it a swipe. */
  maxThresholdPx?: number

  /** Threshold ratio of container width (0-1). */
  thresholdRatio?: number
}

export function useSwipeViews(options: UseSwipeViewsOptions) {
  const {
    viewCount,
    initialIndex = 0,
    axisLockRatio = 1.2,
    minThresholdPx = 60,
    maxThresholdPx = 140,
    thresholdRatio = 0.18,
  } = options

  const lastIndex = Math.max(0, viewCount - 1)

  const [viewIndex, setViewIndex] = useState<number>(() => {
    const clamped = Math.max(0, Math.min(lastIndex, Math.trunc(initialIndex)))
    return clamped
  })

  const swipeRootRef = useRef<HTMLDivElement | null>(null)
  const swipeStateRef = useRef<{
    pointerId: number | null
    startX: number
    startY: number
    started: boolean
    width: number
  }>({ pointerId: null, startX: 0, startY: 0, started: false, width: 0 })

  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!target) return false
    if (!(target instanceof Element)) return false
    return Boolean(
      target.closest(
        'button, a, input, textarea, select, option, label, summary, details, [role="button"], [role="link"], [data-no-swipe]'
          .trim(),
      ),
    )
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left click / touch / pen. Avoid right click.
    if (e.pointerType === 'mouse' && e.button !== 0) return

    // Don't start swiping from inside interactive controls.
    // This prevents pointer-capture from breaking clicks (e.g., <details>/<summary>, buttons, inputs).
    if (isInteractiveTarget(e.target)) return

    const root = swipeRootRef.current
    if (!root) return

    const width = root.clientWidth || 0
    swipeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: true,
      width,
    }

    setIsDragging(true)
    setDragOffsetPx(0)

    // Capture so we keep receiving events even if pointer leaves the element.
    try {
      root.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = swipeStateRef.current
    if (!st.started || st.pointerId !== e.pointerId) return

    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY

    // If it's primarily vertical, don't treat as swipe.
    if (Math.abs(dy) > Math.abs(dx) * axisLockRatio && Math.abs(dy) > 8) {
      setDragOffsetPx(0)
      return
    }

    // Slight resistance at ends.
    let nextDx = dx
    if ((viewIndex === 0 && dx > 0) || (viewIndex === lastIndex && dx < 0)) {
      nextDx = dx * 0.35
    }

    setDragOffsetPx(nextDx)
  }

  const onPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = swipeStateRef.current
    if (!st.started || st.pointerId !== e.pointerId) return

    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    const width = st.width || swipeRootRef.current?.clientWidth || 0

    const isMostlyHorizontal = Math.abs(dx) > Math.abs(dy) * axisLockRatio
    const absDx = Math.abs(dx)
    const threshold = Math.max(minThresholdPx, Math.min(maxThresholdPx, width * thresholdRatio))

    if (isMostlyHorizontal && absDx > threshold) {
      if (dx < 0) setViewIndex((i) => (i < lastIndex ? i + 1 : i))
      if (dx > 0) setViewIndex((i) => (i > 0 ? i - 1 : i))
    }

    swipeStateRef.current = { pointerId: null, startX: 0, startY: 0, started: false, width: 0 }
    setIsDragging(false)
    setDragOffsetPx(0)
  }

  const innerTransform = useMemo(() => {
    return `translate3d(calc(${-viewIndex * 100}% + ${dragOffsetPx}px), 0, 0)`
  }, [dragOffsetPx, viewIndex])

  return {
    viewIndex,
    setViewIndex,
    swipeRootRef,
    onPointerDown,
    onPointerMove,
    onPointerUpOrCancel,
    isDragging,
    innerTransform,
  }
}
