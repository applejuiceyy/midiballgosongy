<script lang="ts">
    import MidiReader, { MIDIMusic, MIDIMusicIterator, type PolledEvent } from "$lib/MidiReader";
    import parser from "midi-parser-js";

    let playables: MIDIMusic[] | null = null;
    let playing: MIDIMusicIterator | null = null;
    let fetchIn: number = 0;
    let currentTick = 0;
    let updaet = 0;

    let isKeyPressed = true;

    let previousMicrosecond = 0;
    let microOfNote = 0;
    let events: string[] = [];

    let eventsToPlay: PolledEvent[] = [];

    let channels: {[index: number]: number}[] = [];
    for(let i = 0; i < 15; i++) {
        channels.push({});
    }

    let notes: {start: number, end: number, verticality: number, channel: number}[] = [];

    function processFile(el: HTMLInputElement) {
        let files = el.files;
        if(files == null) {
            return;
        }
        if(files.length == 0) {
            return;
        }

        let file = files[0];
        file.arrayBuffer().then(buffer => {
            let midiData = parser.parse(new Uint8Array(buffer));

            playables = new MidiReader(midiData).getAvailableMusics();
        });
    }

    function process() {
        if(playing == null) {
            return;
        }
        let currentMicrosecond = performance.now() * 1000;
        let difference = currentMicrosecond - previousMicrosecond;

        let ticksInABeat = playing.owner.owner.data.timeDivision;
        let microsecondsPerBeat = playing.microsecondsPerBeat;

        let howManyBeats = difference / microsecondsPerBeat;
        let howManyTicks = howManyBeats * ticksInABeat;
        if(isKeyPressed) currentTick += howManyTicks;
        while(currentTick >= fetchIn) {
            for(let index = 0; index < eventsToPlay.length; index++) {
                let event = eventsToPlay[index].event;
                if(event.type == 9 && event.data[1] === 0) {
                    event = {
                        ...event,
                        type: 8
                    }
                }

                let add = false;
                if((event.type == 8 || event.type == 9) && channels[event.channel][event.data[0]] != undefined) {
                    let start = channels[event.channel][event.data[0]]
                    notes.push({
                        start: channels[event.channel][event.data[0]],
                        end: fetchIn,
                        verticality: event.data[0],
                        channel: event.channel
                    });
                    notes = notes;

                    delete channels[event.channel][event.data[0]];

                    channels = channels;

                    add = true;
                    events=events;
                }

                if(event.type == 9) {
                    add = true;
                    channels[event.channel][event.data[0]] = fetchIn;
                }

                if(add) {
                    events.push(JSON.stringify(event))
                }




            }

            let fetchData = playing.next();

            if(fetchData.done) {
                playing = null;
                return;
            }
            eventsToPlay = fetchData.value.events;
            fetchIn += fetchData.value.after;

            updaet += 1;
        }
        previousMicrosecond = currentMicrosecond;

    }

    function startPlaying(play: MIDIMusic) {
        playing = play.play();
        console.log(playing);
        currentTick = 0;
        previousMicrosecond = performance.now() * 1000;
        import("$lib/visualisers/worker?worker").then(worker => new worker.default({
            name: "cheese"
        }).terminate());
        setInterval(process, 1);
    }

    function onKeyDown(e: KeyboardEvent) {
        if(e.code == "Space"){
            e.preventDefault();
            isKeyPressed = true;
        }
        if(e.code == "KeyE"){
            e.preventDefault();
            currentTick++;
        }
    }

    function onKeyUp(e: KeyboardEvent) {
        if(e.code == "Space") {
            e.preventDefault();
            isKeyPressed = false;
        }
    }
</script>

<label>Input midi file <input type="file" accept="audio/midi" on:change={(e) => processFile(e.currentTarget)}></label>
{#if playables != null}
    {#each playables as play}
        this is a play
        <button on:click={() => startPlaying(play)}>Play</button>
    {/each}
{/if}
{#if playing != null}
    <button on:click={() => console.log(playing?.next())}>Play</button>
    {#each playing.owner.tracks as track, trackIndex}
        <div style="background-color:#4444ff;margin:5px;">
                {#key updaet}
                {#each {length: Math.min(10, track.event.length - playing.trackInfo[trackIndex].currentPosition)} as _, index}
                
                    {@const event = track.event[index + playing.trackInfo[trackIndex].currentPosition]}
                    <div style="display:inline-block;width:80px;height:40px;background-color: {event.type == 9? '#3333ff' : '#33ff33'};margin:3px;">
                        {event.deltaTime}<br>{JSON.stringify(event)}
                    </div>
                {/each}
            {/key}
        </div>
    {/each}

    {#each eventsToPlay as event}
                
        <div style="display:inline-block;width:80px;height:40px;background-color: {event.event.type == 9? '#3333ff' : '#33ff33'};margin:3px;">
            {event.event.deltaTime}<br>{JSON.stringify(event)}
        </div>
    {/each}
{/if}
{fetchIn - currentTick}
<svg width="10000" height="1000">
    {#each notes as note}
        <rect x={note.start / 30} y={note.verticality * 5} width={(note.end - note.start) / 30} height={5} fill="hsl({note.channel * 20},100%,50%)" stroke="#000000"></rect>
    {/each}
    {#each channels as channel, index}
        {#each Object.entries(channel) as entries}
            <rect x={entries[1] / 30} y={Number(entries[0]) * 5} width={(currentTick - entries[1]) / 30} height={5} fill="hsl({index * 20},100%,50%)" stroke="#000000"></rect>
        {/each}
    {/each}

    {#each eventsToPlay as event}
        {#if event.event.type == 8 || event.event.type == 9}
            <rect x=0 y={event.event.data[0] * 5} width="100%" height={5} fill="#00000044"></rect>
        {/if}
    {/each}
</svg>
{#each events as event}
    {event}<br>
{/each}

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp}/>