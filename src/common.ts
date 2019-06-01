export function cast<T>(value: any): T {
  return (value as unknown) as T;
}
