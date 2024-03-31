<script lang="ts">

    import { onMount } from 'svelte';
    import renderer from "./renderer";

    export let data: BallTrack[];
    export let midi: string;
    let canvas: HTMLCanvasElement;
    let player: any;

    onMount(() => {
        player.start();
        let ev = () => {
            player.stop();
            player.removeEventListener("load", ev);
            renderer(canvas, player, data);
        }
        player.addEventListener("load", ev);
    })
</script>

<canvas bind:this={canvas} style="width: 100vw;height:100vh;">

</canvas>

<midi-player
  bind:this={player}
  src={midi}
  sound-font>
</midi-player>