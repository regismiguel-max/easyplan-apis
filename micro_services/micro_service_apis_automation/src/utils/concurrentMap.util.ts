export async function concurrentMap<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
    concurrency = 5
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
        while (currentIndex < items.length) {
            const index = currentIndex++;
            results[index] = await mapper(items[index], index);
        }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    return results;
}
