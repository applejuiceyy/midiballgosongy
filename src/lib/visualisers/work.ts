//@ts-check
/// <reference no-default-lib="true"/>
/// <reference lib="ES2015" />
/// <reference lib="webworker" />

import type {W2OMessage, W2OLongHaulRequest} from "./worker-types.js";
import things from "./workerglob";

let cancelledTickets = new Set();

self.addEventListener("message", function(event: any) {
    console.log("got message", event.data);
    let data = event.data as W2OMessage
    switch(data.type) {
        case "midi":
            prepareWork(data);
            break;
        case "cancel":
            cancelledTickets.add(data.ticket);
            break;
            default: break;
    }
})

async function prepareWork(data: W2OLongHaulRequest & {type: "midi"}) {
    let symbol = Symbol();
    let lastPing = 0;
    let progressPoster = (action: string, progress: number) => {
        if(cancelledTickets.has(data.ticket)) {
            throw symbol;
        }
        let perf = performance.now();
        if(lastPing > perf - 1) {
            return;
        }
        lastPing = perf;
        postMessage({
            ticket: data.ticket,
            type: "progress",
            progress: progress,
            action: action
        })
    }
    try {
        progressPoster("setting up", 0);
        let thing = await things[data.id].worker();
        progressPoster("setting up", 1);
        let result = (thing as any)(data.data, progressPoster);
        postMessage({
            ticket: data.ticket,
            data: result,
            type: "result"
        })
    }
    catch(e) {
        if(e == symbol) {
            postMessage({
                ticket: data.ticket,
                type: "cancel"
            })
            cancelledTickets.delete(data.ticket);
            return;
        }
        throw e;
    }
}

export default 10;