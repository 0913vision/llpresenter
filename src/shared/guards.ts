// 바깥에서 들어온 값(IPC 메시지, 파일)을 검사하는 작은 도우미.
// 스키마 검사 라이브러리를 고르면 그쪽으로 옮긴다(docs/TECH.md).

export type UnknownRecord = Readonly<Record<string, unknown>>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isString)
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}
