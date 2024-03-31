interface AbsoluteNote {
    duration: number
    instrument: number,
    instrumentName: string,
    note: number,
    at: number
}

interface Bar {
    x: number,
    y: number,
    width: number,
    height: number,
    duration: number,
    color: number
}

interface Snapshot {
    mx: number,
    my: number,
    x: number,
    y: number
}

interface Section {
    bar: Bar,
    snapshot: Snapshot,
    activate: number
}

interface BallTrack {
    sections: Section[],
    finalSnapshot: Snapshot,
    instrument: number,
    instrumentName: string
}