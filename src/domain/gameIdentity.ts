/**
 * Two games are the same night's sheet when date and game number match.
 * Empty game numbers count as equal (both null).
 */
export function isSameGameIdentity(
  a: { gameDate: string; gameNumber: number | null },
  b: { gameDate: string; gameNumber: number | null },
): boolean {
  return a.gameDate === b.gameDate && a.gameNumber === b.gameNumber;
}

export function findDuplicateGame<T extends { gameDate: string; gameNumber: number | null }>(
  candidate: T,
  existing: T[],
): T | undefined {
  return existing.find((game) => isSameGameIdentity(game, candidate));
}

export function duplicateGameMessage(game: {
  gameDate: string;
  gameNumber: number | null;
}): string {
  if (game.gameNumber !== null) {
    return `A game dated ${game.gameDate} with number ${game.gameNumber} is already saved.`;
  }
  return `A game dated ${game.gameDate} with no game number is already saved.`;
}
