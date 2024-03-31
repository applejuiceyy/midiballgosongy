export default function getSnapshot(snapshot: Snapshot, t: number): Snapshot {
    if(t < 0) {
        snapshot.mx *= -1;
        snapshot.my *= -1;
        let g = getSnapshot(snapshot, -t);
        snapshot.mx *= -1;
        snapshot.my *= -1;
        g.mx *= -1;
        g.my *= -1;
        return g;
    }
    return {
        x: snapshot.mx * t + snapshot.x,
        y: snapshot.my * t + (Math.pow(t, 2) / 2 * 350) + snapshot.y,
        mx: snapshot.mx,
        my: snapshot.my + t * 350
    }
} globalThis._e = getSnapshot;