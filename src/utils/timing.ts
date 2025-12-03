export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sleepRandom(min: number, max: number): Promise<void> {
  const delay = randomDelay(min, max);
  return sleep(delay);
}

