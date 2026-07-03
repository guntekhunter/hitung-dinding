// app/utils/workerManager.ts

let workerInstance: Worker | null = null;
let requestCounter = 0;

const pendingRequests = new Map<
    string,
    (data: any) => void
>();

export const getWorker = () => {
    if (typeof window === 'undefined') return null;

    if (!workerInstance) {
        workerInstance = new Worker(
            new URL('./calcWorker.ts', import.meta.url)
        );

        // Only ONE listener for the lifetime of the app
        workerInstance.onmessage = (e: MessageEvent) => {
            const { requestId } = e.data;

            const resolve = pendingRequests.get(requestId);

            if (resolve) {
                pendingRequests.delete(requestId);
                resolve(e.data);
            }
        };
    }

    return workerInstance;
};

export const callWorker = (
    type: string,
    data: any
): Promise<any> => {
    const worker = getWorker();

    if (!worker) {
        return Promise.resolve(null);
    }

    const requestId = (++requestCounter).toString();

    return new Promise((resolve) => {
        pendingRequests.set(requestId, resolve);

        worker.postMessage({
            type,
            data,
            requestId,
        });
    });
};

// Optional: initialize the worker before the user clicks
export const warmupWorker = () => {
    return callWorker('warmup', null);
};