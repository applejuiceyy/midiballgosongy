<script lang="ts">
    import MidiReader, { MIDIMusic, MIDIMusicIterator, type PolledEvent } from "$lib/MidiReader";
    import things, { constructWorker } from "$lib/visualisers";
    import parser from "midi-parser-js";
    import { SvelteComponent, onMount } from "svelte";

    let musics: MIDIMusic[] | null = null;
    let midiURL: string | null = null;
    let selected: MIDIMusic | null = null;
    let worker: any = null;

    let visualiser: SvelteComponent | null = null;
    let data: any | null = null;


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

            let e = new MidiReader(midiData).getAvailableMusics();

            if(e.length == 1) {
                selected = e[0];
            }
            else {
                musics = e;
            }
            midiURL = URL.createObjectURL(file);
        });
    }

    function bootVisualiser(play: MIDIMusic, visualiser: string) {
        console.log("owrking")
        console.log(play.structure());
        worker.longHaul({
            type: "midi",
            id: visualiser,
            data: play.structure()
        }, {
            progress: (progress, name) => {
                console.log("progress:", progress, name);
            },

            result: (d) => {
                console.log("data:", d);
                data = d;
            },

            cancel: () => {
                console.log("cancelled");
            }
        });
    }

    onMount(() => {
        constructWorker().then(e => worker = e);
    })
</script>



{#if data != null && visualiser != null}
        <svelte:component this={visualiser} data={data} midi={midiURL}/>
{:else}
<label>Input midi file <input type="file" accept="audio/midi" on:change={(e) => processFile(e.currentTarget)}></label>
    {#if musics != null}
        {#each musics as music}
            <button on:click={() => {selected = music; musics = null}}>select music</button>
        {/each}
    {/if}

    {#if selected != null}
        {#each Object.keys(things) as v}
            {@const e = selected}
            <button on:click={() => {
                bootVisualiser(e, v);
                things[v].visualiser().then(e => visualiser = e);
                selected = null;
                }}>select visualiser</button>
        {/each}
    {/if}
{/if}

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
    }
</style>