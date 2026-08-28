const numericCollator = new Intl.Collator(undefined, { numeric: true });

export function compareNaturalIdentifiers(
  first: string,
  second: string
): number {
  return numericCollator.compare(first, second);
}
