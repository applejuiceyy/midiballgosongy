interface Thing {
    worker: () => Promise<unknown>,
    visualiser: () => Promise<unknown>
}

let things: {[index: string]: Thing} = Object.create(null);

function add(directive: keyof Thing, name: string | undefined, thing: () => Promise<unknown>) {
    if(name === undefined) {
        return;
    }

    if(things[name] === undefined) {
        things[name] = {} as Thing;
    }

    things[name][directive] = thing
}

let availableWorkers = import.meta.glob("./visualisers/*/worker.ts", {
    eager: false,
    import: "default"
})

let reg = new RegExp("\\./visualisers/(.+?)/worker\\.ts")
Object.entries(availableWorkers).forEach(entry => {
    add("worker", reg.exec(entry[0])?.[1], entry[1])
})
let availableVisualisers = import.meta.glob("./visualisers/*/visualiser.svelte", {
    eager: false,
    import: "default"
})
reg = new RegExp("\\./visualisers/(.+?)/visualiser\\.svelte")
Object.entries(availableVisualisers).forEach(entry => {
    add("visualiser", reg.exec(entry[0])?.[1], entry[1])
})

export default things
