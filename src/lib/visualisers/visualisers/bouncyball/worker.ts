import Reader, {type MIDIEvent} from "$lib/MidiReader";
import getSnapshot from "./physics";

export default function(data: any, progress: (progress: number | null, action: string) => void) {
    debugger;
    let playable = new Reader(data).allTracksAsMusic();
    let player = playable.play();

    let m = null;
    let notes: AbsoluteNote[] = [];
    
    let channels: {[index: number]: number}[] = [];
    for(let i = 0; i < 16; i++) {
        channels.push({});
    }

    let totalMilliseconds = 0;

    progress(null, "preamble");
    while(!(m = player.next()).done) {
        let ticksInABeat = player.owner.owner.data.timeDivision;
        let microsecondsPerBeat = player.microsecondsPerBeat;

        let willPlayAfterNTicks = m.value.after;
        let howManyBeatsIsThat = willPlayAfterNTicks / ticksInABeat;
        let howManyMicroseconds = howManyBeatsIsThat * microsecondsPerBeat;
        let milliseconds = howManyMicroseconds / 1000;
        totalMilliseconds += milliseconds;

        for(let i = 0; i < m.value.events.length; i++) {
            let meta = m.value.events[i]
            let event = meta.event;

            if(event.type == 9 && event.data[1] === 0) {
                event = {
                    ...event,
                    type: 8
                }
            }

            
            if((event.type == 8 || event.type == 9) && channels[event.channel][event.data[0]] != undefined) {
                let start = channels[event.channel][event.data[0]]
                notes.push({
                    at: start,
                    duration: totalMilliseconds - start,
                    note: event.data[0],
                    instrument: meta.track,
                    instrumentName: player.trackInfo[meta.track].currentName
                });

                delete channels[event.channel][event.data[0]];
            }

            if(event.type == 9) {
                channels[event.channel][event.data[0]] = totalMilliseconds;
            }
        }
    }

    notes.sort((a, b) => a.at-b.at)


    return generateTracks(notes, progress);
}

function generateTracks(notes: AbsoluteNote[], progress: (progress: number | null, action: string) => void) {
    let tracks: Map<number, BallTrack[]> = new Map();
    mainland: for(let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
        progress(noteIndex / notes.length, "Main track generation");

        let note = notes[noteIndex];
        
        let tracksOfInstrument = tracks.get(note.instrument) ?? [];
        tracks.set(note.instrument, tracksOfInstrument);

        let score = 99999999;
        let best = -1;

        for(let i = 0; i < tracksOfInstrument.length; i++) {
            let track = tracksOfInstrument[i];
            let lastSection = track.sections[track.sections.length - 1];
            let lastSnapshot = track.finalSnapshot;

            let collisionSnapshot = getSnapshot(lastSnapshot, (note.at - lastSection.activate) / 1000);

            if(collisionSnapshot.my < 40 && collisionSnapshot.my > -40) {
                continue; // awkward collisions
            }

            if(Math.abs(lastSnapshot.y - collisionSnapshot.y) < 13 && Math.sign(lastSnapshot.my) == Math.sign(collisionSnapshot.my)) {
                continue; // restless collisions
            }

            if(score > lastSection.activate) {
                score = lastSection.activate
                best = i
                break;
            }
        }

        if(best >= 0) {
            let track = tracksOfInstrument[best];

            let lastSection = track.sections[track.sections.length - 1];
            let lastSnapshot = track.finalSnapshot;

            let collisionSnapshot = getSnapshot(lastSnapshot, (note.at - lastSection.activate) / 1000);
            let ceilingCollision = collisionSnapshot.my > 0;

            track.sections.push({
                activate: note.at,
                snapshot: collisionSnapshot,
                bar: {
                    x: collisionSnapshot.x - 10,
                    width: 20,
                    y: (ceilingCollision ? 5 : -6) + collisionSnapshot.y,
                    height: 1,
                    duration: note.duration,
                    color: note.note
                }
            })

            let finalSnapshot = {...collisionSnapshot}
            finalSnapshot.my *= -0.9
            track.finalSnapshot = finalSnapshot

            continue mainland
        }

        let startingCollision: Snapshot = {
            x: note.at / 10,
            mx: 50,
            my: 100,
            y: 0
        }

        let finalSnapshot = {...startingCollision}
        finalSnapshot.my *= -0.9

        let newTrack: BallTrack = {
            sections: [{
                activate: note.at,
                snapshot: startingCollision,
                bar: {
                    x: startingCollision.x - 10,
                    width: 20,
                    y: 5 + startingCollision.y,
                    height: 1,
                    duration: note.duration,
                    color: note.note
                }
            }],
            finalSnapshot: finalSnapshot,
            instrument: note.instrument,
            instrumentName: note.instrumentName
        }


        tracksOfInstrument.push(newTrack);
    }

    return Array.from(tracks.values()).flat(1);
}