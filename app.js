window.$$ = document.querySelector.bind(document);

window.App = {
    render_seconds: 10,
    preview_seconds: 8,
    update_interval_ms: 1500,
    prepare_ms: 3000,
    wavesurferOptions: (container, offset, drag) => ({
        container: container,
        waveColor: "violet",
        fillParent: false,
        scrollParent: true,
        interact: false,
        autoCenter: false,
        plugins: [
            WaveSurfer.regions.create({
                regions: [{
                    start: offset < 0 ? offset * (-1) : 0,
                    end: offset < 0 ? offset * (-1) + App.preview_seconds : App.preview_seconds - (offset || 0),
                    color: "rgba(255, 128, 128, 0.4)",
                    resize: false,
                    drag: drag !== undefined ? drag : true
                }]
            })
        ]
    })
};

function initializeMix() {
    $$("#dates-from").addEventListener("change", () => {
        $$("#dates-to").value = $$("#dates-from").value;
        $$("#date").submit();
    });
    $$("#dates-to").addEventListener("change", () => $$("#date").submit());

    $$("#reset").addEventListener("submit", e => {
        e.preventDefault();
        if (confirm("Sicher? Dies löscht alle Aufnahmen."))
            updateState({reset: true});
    });

    const songWavesurfer = WaveSurfer.create(App.wavesurferOptions("#songWavesurfer"));
    songWavesurfer.load("songs/" + $$("#songWavesurfer").dataset.song);
    songWavesurfer.seekAndCenter(0);
    songWavesurfer.zoom(pxPerSec());
    const wavesurfers = [];

    document.querySelectorAll(".wavesurfer").forEach(div => {
        const offset = parseFloat(div.dataset.offset);
        const wavesurfer = WaveSurfer.create(App.wavesurferOptions(
            "#" + div.id, offset, false));
        wavesurfer.load("uploads/" + div.dataset.file);
        wavesurfer.seekAndCenter(0);
        wavesurfer.zoom(pxPerSec());
        const gainNode = wavesurfer.backend.ac.createGain();
        const delayNode = offset > 0 ? wavesurfer.backend.ac.createDelay(offset) : null;
        gainNode.gain.value = parseFloat(div.dataset.gain);
        if (offset > 0)
            delayNode.delayTime.value = offset;
        wavesurfer.backend.setFilters(offset > 0 ? [gainNode, delayNode] : [gainNode]);
        wavesurfers.push(wavesurfer);
    });

    const allWavesurfers = wavesurfers.concat([songWavesurfer]);

    Promise.all(allWavesurfers.map(wavesurfer =>
        new Promise(resolve => wavesurfer.on("ready", resolve)))).then(() => {
        const preview = $$("#preview");
        preview.disabled = false;
        preview.addEventListener("click", e => {
            e.preventDefault();
            const playback = $$("#playback").checked;
            const playWavesurfers = playback ? allWavesurfers : wavesurfers;
            if (preview.innerText === "Abspielen") {
                playWavesurfers.forEach(wavesurfer => Object.values(wavesurfer.regions.list)[0].play());
                preview.innerText = "Stoppen";
            } else {
                playWavesurfers.forEach(wavesurfer => wavesurfer.stop());
                preview.innerText = "Abspielen";
            }
        });
        document.querySelectorAll(".wavesurfer > wave").forEach(wave => wave.scroll(0, 0));
        $$("#loading").style.display = "none";
        $$("#editing").style.display = "block";
    });
}