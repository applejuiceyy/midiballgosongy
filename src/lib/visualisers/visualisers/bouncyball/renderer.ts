import * as PIXI from 'pixi.js';
import getSnapshot from "./physics";

// https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color);   // convert to Hex and prefix "0" if needed
    };
    return f(0) << 8 << 8 | f(8) << 8 | f(4);
}

function *getAllSides(area: number): Generator<{x: number, y: number}, void, void> {
    let vertical = 1;
    while(vertical <= area) {
        for(let i = 1; i * vertical <= area; i++) {
            if(i * vertical == area) {
                yield {y: vertical, x: i};
            }
        }
        vertical++;
    }

}

function getBestDefinition(width: number, height: number, items: number, ratio: number): [{x: number, y: number}, number] {
    let m;
    let g = getAllSides(items);
    let best = {x: 0, y: 0};
    let score = 9999;
    while(!(m = g.next()).done) {
        let sides = m.value;

        let itemWidth = width / sides.x;
        let itemHeight = height / sides.y;

        let thisRatio = itemWidth / itemHeight;
        let performance = Math.abs(thisRatio - ratio);

        if(score > performance) {
            score = performance;
            best = sides;
        }
    }

    return [best, score];
}

function getPosition(t: number[], track: BallTrack): {snapshot: Snapshot, sectionIndex: number | null}[] {
    let p = t.map((value, index) => [value, index] as [number, number]).sort((a, b) => a[0] - b[0]);
    let ret: {snapshot: Snapshot, sectionIndex: number | null}[] = new Array(t.length);
    let target = 0;

    for(let o = 0; o < track.sections.length && target < t.length; o++) {
        let section = track.sections[o];

        while(target < t.length && p[target][0] < section.activate) {
            let snapshot = getSnapshot(section.snapshot, (p[target][0] - section.activate) / 1000);
            ret[p[target][1]] = {snapshot, sectionIndex: o};
            target++;
        }
    }

    for(; target < p.length; target++) {
        ret[p[target][1]] = {snapshot: getSnapshot(track.finalSnapshot, (p[target][0] - track.sections[track.sections.length - 1].activate) / 1000), sectionIndex: null};
    }

    return ret;
}

export default function(node: HTMLCanvasElement, player: any, data: BallTrack[]) {
    let application = new PIXI.Application({
        view: node,
        autoDensity: true,
        width: window.innerWidth,
        height: window.innerHeight,
        antialias: true
    });
    globalThis.__PIXI_APP__ = application;
    

    let renderedStuff: {
        rootContainer: PIXI.Container,
        offsetContainer: PIXI.Container,
        maskGraphics: PIXI.Graphics,
        platformGraphics: PIXI.Graphics,
        ballGraphics: PIXI.Graphics,
        hitGraphics: PIXI.Graphics,
        streakGraphics: PIXI.Graphics,
        trackName: PIXI.Text
    }[] = []

    let configuration: {x: number, y: number};


    let patternHitGraphics = new PIXI.Graphics();
    let patternMaskGraphics = new PIXI.Graphics();


    let patternBallGraphics = new PIXI.Graphics();
    patternBallGraphics.beginFill("#ff0000");
    patternBallGraphics.drawCircle(0, 0, 5);
    patternBallGraphics.endFill();

    for(let i = 0; i < data.length; i++) {
        let rootContainer = new PIXI.Container();
        let offsetContainer = new PIXI.Container();
        let maskGraphics = new PIXI.Graphics(patternMaskGraphics.geometry)
        let platformGraphics = new PIXI.Graphics();
        let ballGraphics = new PIXI.Graphics(patternBallGraphics.geometry);
        let hitGraphics = new PIXI.Graphics(patternHitGraphics.geometry);
        let streakGraphics = new PIXI.Graphics();
        let trackName = new PIXI.Text(data[i].instrumentName, {
            fill: "ffffff",
            fontSize: 10,
            
        });
        trackName.resolution = 3
        hitGraphics.tint = hslToHex(data[i].instrument * 30, 100, 50);

        platformGraphics.beginFill("#ffffff");


        let track = data[i];
        for(let j = 0; j < track.sections.length; j++) {
            let section = track.sections[j];
            let bar = section.bar
            platformGraphics.drawRect(bar.x, bar.y, bar.width, bar.height);
        }

        platformGraphics.endFill();

        offsetContainer.addChild(platformGraphics); 
        offsetContainer.addChild(streakGraphics);
        offsetContainer.addChild(ballGraphics);
        rootContainer.addChild(hitGraphics);
        rootContainer.addChild(offsetContainer);
        rootContainer.addChild(maskGraphics);
        rootContainer.addChild(trackName);

        rootContainer.mask = maskGraphics;

        renderedStuff.push({
            rootContainer,
            offsetContainer,
            maskGraphics,
            platformGraphics,
            ballGraphics,
            hitGraphics,
            streakGraphics,
            trackName
        })

        application.stage.addChild(rootContainer);
    }

    let start = performance.now();
    let offset = 0;
    for(let i = 0; i < data.length; i++) {
        offset = Math.min(data[i].sections[0].activate - 4000, offset);
    }

    let startedPlaying = false;

    let updatePositions = () => {
        let score;
        let items = data.length;
        do {
            [configuration, score] = getBestDefinition(application.renderer.width, application.renderer.height, items, 2);
            items++;
        } while(score > 0.3);

        for(let i = 0; i < renderedStuff.length; i++) {
            let stuff = renderedStuff[i];
            stuff.rootContainer.position.set(
                (i % (configuration.x)) / configuration.x * application.renderer.width,
                Math.floor(i / (configuration.x)) / configuration.y * application.renderer.height
            );
        }
        patternMaskGraphics.clear();
        patternMaskGraphics.beginFill("#ffffff");
        patternMaskGraphics.drawRect(0, 0, application.renderer.width / configuration.x, application.renderer.height / configuration.y);
        patternMaskGraphics.endFill();

        patternHitGraphics.clear();
        patternHitGraphics.beginFill("ffffff");
        patternHitGraphics.drawRect(0, 0, 10, application.renderer.height / configuration.y);
        patternHitGraphics.endFill();
    }

    let currentWidth = window.innerWidth;
    let currentHeight = window.innerHeight;
    updatePositions();

    application.ticker.add(() => {
        if(window.innerWidth != currentWidth || window.innerHeight != currentHeight) {
            application.renderer.resize(window.innerWidth, window.innerHeight)
            currentWidth = window.innerWidth
            currentHeight = window.innerHeight
            updatePositions();
        }
        let progress = (performance.now() - start) + offset;

        if(progress < 5000) {
            // I give up appropriately making the player synced up so take this curb ball
            player.currentTime = progress / 1000;
        }

        if(progress >= 0) {
            if(!startedPlaying) {
                player.loop = false;
                startedPlaying = true;
                player.start();
            }

        }

        for(let i = 0; i < renderedStuff.length; i++) {
            let stuff = renderedStuff[i];

            let cameraPos = getPosition([progress, progress - 50, progress - 100, progress - 150, progress - 200, progress - 250, progress - 300,progress - 350, progress - 400], data[i]);

            let ballPos = cameraPos[0];
            let previous = (ballPos.sectionIndex == null ? data[i].sections.length : ballPos.sectionIndex) - 1;
            let previousSection = data[i].sections[previous];

            if(ballPos.sectionIndex == 0) {
                stuff.hitGraphics.alpha = 0;
            }
            else {
                stuff.hitGraphics.alpha = 1 / ((progress - previousSection.activate) / 50);
            }

            if(ballPos.sectionIndex == null) {
                stuff.rootContainer.alpha = 1 / ((progress - previousSection.activate) / 500);
            }
            else {
                let bFade = previousSection == null ? 999999 : Math.max(0, (progress - previousSection.activate) - 1000);
                let eFade = Math.max(0, data[i].sections[ballPos.sectionIndex].activate - (progress + 1000));
                stuff.rootContainer.alpha = 1 / (Math.max(Math.min(bFade, eFade) / 100, 1));
            }

            stuff.rootContainer.visible = stuff.rootContainer.alpha > 0.1

            if(stuff.rootContainer.visible) {
                stuff.ballGraphics.position.set(ballPos.snapshot.x, ballPos.snapshot.y);

                let avg = {x: 0, y: 0};

                for(let p = 0; p < cameraPos.length; p++) {
                    avg.x += cameraPos[p].snapshot.x;
                    avg.y += cameraPos[p].snapshot.y;
                }

                let cameraPosY = avg.y / cameraPos.length
                if(Math.abs(cameraPosY - ballPos.snapshot.y) > application.renderer.height / configuration.y / 2 / 2) {
                    cameraPosY = ballPos.snapshot.y + Math.sign(cameraPosY - ballPos.snapshot.y) * application.renderer.height / configuration.y / 2 / 2
                }

                stuff.offsetContainer.position.set(-avg.x / cameraPos.length + 20, -cameraPosY + application.renderer.height / configuration.y / 2)

                stuff.streakGraphics.clear();
                stuff.streakGraphics.lineStyle({
                    width: 2,
                    color: "888888"
                })
                stuff.streakGraphics.moveTo(ballPos.snapshot.x, ballPos.snapshot.y);
                for(let i = 1; i < cameraPos.length; i++) {
                    stuff.streakGraphics.lineTo(cameraPos[i].snapshot.x, cameraPos[i].snapshot.y);
                }
            }
        }
    });

    application.start();
}