// D1 allows 100 bound parameters per statement: split items so each chunk fits beside `fixedParams` other parameters.
// `paramsPerItem` is how many parameters one item binds (e.g. 2 for a kpiId + periodDate pair).
export async function inChunks<I, T>(
  items: I[],
  fixedParams: number,
  run: (chunk: I[]) => Promise<T[]>,
  paramsPerItem = 1,
): Promise<T[]> {
  const size = Math.max(1, Math.floor((100 - fixedParams) / paramsPerItem));
  const chunks: I[][] = [];
  for (let offset = 0; offset < items.length; offset += size) chunks.push(items.slice(offset, offset + size));
  return (await Promise.all(chunks.map(run))).flat();
}
