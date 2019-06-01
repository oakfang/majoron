export function cast<T>(value: any): T {
  return (value as unknown) as T;
}
export type Pair<T, U> = [T, U];
