import { useEffect, useState } from 'react'
import { sizeClassFor, type SizeClass } from './sizeClass'

/** 창 너비가 구간 경계를 넘을 때만 다시 그린다(같은 값이면 React가 건너뜀). */
export function useSizeClass(): SizeClass {
  const [value, setValue] = useState<SizeClass>(() => sizeClassFor(window.innerWidth))
  useEffect(() => {
    const onResize = (): void => setValue(sizeClassFor(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return value
}
