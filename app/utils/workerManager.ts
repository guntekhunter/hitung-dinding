// app/utils/workerManager.ts

let workerInstance: Worker | null = null;

export const getWorker = () => {
    if (typeof window !== 'undefined' && !workerInstance) {
        workerInstance = new Worker(new URL('./calcWorker.ts', import.meta.url));
    }
    return workerInstance;
};

export const callWorker = (type: string, data: any): Promise<any> => {
    const worker = getWorker();
    if (!worker) return Promise.resolve(null);

    const requestId = Math.random().toString(36).substring(7);
    
    return new Promise((resolve) => {
        const handler = (e: MessageEvent) => {
            if (e.data.requestId === requestId) {
                worker.removeEventListener('message', handler);
                resolve(e.data);
            }
        };
        
        worker.addEventListener('message', handler);
        worker.postMessage({ type, data, requestId });
    });
};
