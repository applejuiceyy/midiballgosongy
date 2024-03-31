
type Data4ValueMetaEvent = {
    data: [number, number, number, number],
    metaType: 0x58
}

type Data5ValueMetaEvent = {
    data: [number, number, number, number, number],
    metaType: 0x54
}

type DataStringMetaEvent = {
    data: string,
    metaType: 0x01 | 0x02 | 0x03 | 0x04 | 0x05 | 0x07 | 0x06
}

type DataValueMetaEvent = {
    data: number,
    metaType: 0x21 | 0x59 | 0x51
}

type MIDIMetaEvent = (DataStringMetaEvent | DataValueMetaEvent | Data4ValueMetaEvent | Data5ValueMetaEvent) & {type: 255}


type DataValueNormalEvent = {
    data: number
    type: 0xC | 0xD
}

type Data2ValueNormalEvent = {
    data: [number, number]
    type: 0xA | 0xB | 0xE | 0x8 | 0x9
}

type MIDINormalEvent = (Data2ValueNormalEvent | DataValueNormalEvent) & {channel: number}

export type MIDIEvent = (MIDIMetaEvent | MIDINormalEvent)  & {deltaTime: number};

type Track = {event: MIDIEvent[]}

interface MIDI<formatType extends 0 | 1 | 2> {
    formatType: formatType,
    timeDivision: number,
    tracks: number,
    track: formatType extends 0 ? [Track] : (formatType extends 1 ? [Track, ...Track[]] : Track[])
}

interface Channel {
    currentInstrument: number;
    instrumentName: string;
    pressedKeys: Set<number>;
}

interface RunningTrack {
    currentPosition: number;
    currentTick: number;
    currentName: string;
    finished: boolean;
}

export interface PolledEvent {
    position: number,
    track: number,
    event: MIDIEvent
}

interface MIDIIterationResult {
    after: number,
    events: PolledEvent[]
}

export class MIDIMusicIterator implements Generator<MIDIIterationResult, void, void> {
    owner: MIDIMusic;
    microsecondsPerBeat: number;
    trackInfo: RunningTrack[];
    finished: boolean;
    currentTick: number;
    channels: Channel[];
    currentEvents: PolledEvent[];
    
    constructor(owner: MIDIMusic) {
        this.owner = owner;
        this.trackInfo = owner.tracks.map(() => {
            return {
                currentName: "",
                currentPosition: 0,
                currentTick: 0,
                finished: false
            }
        });
        this.microsecondsPerBeat = 60000000 / 120;
        this.finished = false;
        this.currentTick = 0;
        this.channels = [];
        for(let i = 0; i < 16; i++) {
            this.channels.push({
                currentInstrument: 0,
                instrumentName: "",
                pressedKeys: new Set()
            });
        } 
        this.currentEvents = [];
    }

    next(...args: [] | [void]): IteratorResult<MIDIIterationResult, void> {
        if(this.finished) {
            return {done: true, value: undefined};
        }

        for(let event = 0; event < this.currentEvents.length; event++) {
            this.postProcessEvent(this.currentEvents[event]);
        }

        let nextEvents: PolledEvent[] = [];
        let minimal = Infinity;
        let winningTracks = [];

        for(let trackIndex = 0; trackIndex < this.owner.tracks.length; trackIndex++) {
            if(this.trackInfo[trackIndex].finished) continue;

            let track = this.owner.tracks[trackIndex].event;
            let currentEvent = this.trackInfo[trackIndex].currentPosition;
            let currentTick = this.trackInfo[trackIndex].currentTick;
            let finished = false;


            while((currentTick + track[currentEvent].deltaTime) < this.currentTick) {
                currentTick += track[currentEvent].deltaTime;
                currentEvent++;
                if(currentEvent >= track.length) {
                    finished = true;
                }
            }

            this.trackInfo[trackIndex].currentPosition = currentEvent;
            this.trackInfo[trackIndex].currentTick = currentTick;
            this.trackInfo[trackIndex].finished = finished;

            if(!finished) {
                let absoluteTick = track[currentEvent].deltaTime + currentTick;
                currentTick += track[currentEvent].deltaTime;
                if(minimal == null || (absoluteTick - this.currentTick) <= minimal) {
                    if((absoluteTick - this.currentTick) < minimal) {
                        nextEvents = [];
                        winningTracks = [];
                    }

                    minimal = absoluteTick - this.currentTick;
    
                    nextEvents.push({
                        track: trackIndex,
                        position: currentEvent,
                        event: track[currentEvent]
                    });
    
                    currentEvent++;
                    if(currentEvent >= track.length) {
                        finished = true;
                    }


                    while(!finished && track[currentEvent].deltaTime == 0) {
                        nextEvents.push({
                            track: trackIndex,
                            position: currentEvent,
                            event: track[currentEvent++]
                        });
                        if(currentEvent >= track.length) {
                            finished = true;
                        }
                    }
                    winningTracks.push({
                        track: trackIndex,
                        event: currentEvent,
                        currentTick: currentTick,
                        finished: finished
                    })
                }
            }
        }

        if(winningTracks.length == 0) {
            this.finished = true;
            return {
                done: true,
                value: undefined
            }
        }

        this.currentTick = this.currentTick + minimal;
        for(let i = 0; i < winningTracks.length; i++) {
            this.trackInfo[winningTracks[i].track].currentPosition = winningTracks[i].event;
            this.trackInfo[winningTracks[i].track].currentTick = winningTracks[i].currentTick;
            this.trackInfo[winningTracks[i].track].finished = winningTracks[i].finished;
        }

        for(let event = 0; event < nextEvents.length; event++) {
            this.processEvent(nextEvents[event]);
        }

        return {
            done: false,
            value: {
                after: minimal,
                events: nextEvents
            }
        }
    }

    processEvent(event: PolledEvent) {
        if(event.event.type == 255) {
            if(event.event.metaType == 3) {
                this.trackInfo[event.track].currentName = event.event.data;
            }
            if(event.event.metaType == 81) {
                this.microsecondsPerBeat = event.event.data;
                let microsecondsPerMinute = 60000000
                //console.log("new BPM: " + microsecondsPerMinute / this.microsecondsPerBeat);
            }
        }
        if(event.event.type == 12) {
            this.channels[event.event.channel].currentInstrument = event.event.data;
        }
        if(event.event.type == 9) {
            //console.log("note on in " + this.trackInfo[event.track].currentName);
        }

    }
    postProcessEvent(event: PolledEvent) {

    }

    getChannelState(channel: number) {
        return this.channels[channel];
    }

    return(value: void): IteratorResult<MIDIIterationResult, void> {
        this.finished = true;
        return {done: true, value: value};
    }
    throw(e: any): IteratorResult<MIDIIterationResult, void> {
        this.finished = true;
        return {done: true, value: undefined};
    }


    [Symbol.iterator](): Generator<MIDIIterationResult, void, void> {
        return this;
    }
}

export class MIDIMusic {
    owner: MidiReader;
    tracks: Track[];

    constructor(reader: MidiReader, tracks: Track[]) {
        this.owner = reader;
        this.tracks = tracks;
    }

    play(): MIDIMusicIterator {
        return new MIDIMusicIterator(this);
    }

    // not everything in the return is a copy
    structure() {
        if(this.tracks.length == this.owner.data.track.length) {
            return this.owner.data;
        }
        let old = this.owner.data.track;
        this.owner.data.track = [];
        let partialCopy: MIDI<0 | 1 | 2> = JSON.parse(JSON.stringify(this.owner.data));
        this.owner.data.track = old;
        partialCopy.track = this.tracks;
        partialCopy.tracks = this.tracks.length;
        return partialCopy;
    }
}

export default class MidiReader {
    data: MIDI<0 | 1 | 2>

    constructor(data: MIDI<0 | 1 | 2>) {
        this.data = data
    }

    getAvailableMusics(): MIDIMusic[] {
        switch(this.data.formatType) {
            case 0:
                return [new MIDIMusic(this, [this.data.track[0]])]
            case 1:
                return [new MIDIMusic(this, this.data.track)]
            case 2:
                return this.data.track.map(track => new MIDIMusic(this, [track]))
            default:
                return []
        }
    }

    isolateTrack(trackIndex: number) {
        return new MIDIMusic(this, [this.data.track[trackIndex]]);
    }

    selectTracksAsMusic(tracks: number[]) {
        return new MIDIMusic(this, this.data.track.filter((_, index) => tracks.includes(index)));
    }
    
    allTracksAsMusic() {
        return new MIDIMusic(this, this.data.track);
    }
}