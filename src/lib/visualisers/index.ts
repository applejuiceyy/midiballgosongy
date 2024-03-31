import type { O2WMessage, W2OLongHaulRequest } from "./worker-types";
import workerUrl from "./work.ts?url";
import things from "./glob";

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

interface LongHaulCallback {
    progress: (progress: number | null, name: string) => void;
    result: (data: any) => void
    cancel: () => void
}

class WorkerWrapper {
    worker: Worker;
    nextTicket: number = 0;
    tickets: Map<number, LongHaulCallback> = new Map();

    constructor(worker: Worker) {
        this.worker = worker;
        worker.addEventListener("message", ev => {
            let data: O2WMessage = ev.data;
            console.log("got message", data);
            if(data.type == "progress") {
                let callback: LongHaulCallback | undefined = this.tickets.get(data.ticket);
                if(callback != undefined) {
                    callback.progress(data.progress, data.action);
                }
            }
            else if(data.type == "result") {
                let callback: LongHaulCallback | undefined = this.tickets.get(data.ticket);
                if(callback != undefined) {
                    callback.result(data.data);
                    this.tickets.delete(data.ticket);
                }
            }
            else if(data.type == "cancel") {
                let callback: LongHaulCallback | undefined = this.tickets.get(data.ticket);
                if(callback != undefined) {
                    callback.cancel();
                    this.tickets.delete(data.ticket);
                }
            }
        });
    }

    longHaul(data: DistributiveOmit<W2OLongHaulRequest, "ticket">, callback: LongHaulCallback) {
        let ticket = this.nextTicket++;
        let message: W2OLongHaulRequest = {...data, ticket: ticket};
        this.tickets.set(ticket, callback);
        this.worker.postMessage(message);
        return () => {
            this.worker.postMessage({
                type: "cancel",
                ticket: ticket
            });
        }
    }

    terminate() {
        this.worker.terminate();
        this.tickets.forEach((value) => value.cancel());
        this.tickets.clear();
    }
}

export async function constructWorker() {
    return new WorkerWrapper(new Worker(workerUrl, {
        name: "visualiser worker",
        type: "module"
    }));
}

const e: Omit<({type: "e", value: number} | {type: "b", gogle: number}) & {cheese: string}, "cheese"> = {
    type: "b"
}



export default things