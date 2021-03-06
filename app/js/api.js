export const post = params => {
    const data = new FormData();
    for (const key in params)
        data.append(key, params[key]);
    return fetch("/php/app.php", {method: "POST", body: data});
};

export const uploadTrack = (blobUri, name, register, song, songOffset, recordingOffset, gain, automix) =>
    fetch(blobUri)
        .then(res => res.blob())
        .then(blob => post({
            name, register, song, songOffset, recordingOffset, gain, automix,
            date: (new Date).toISOString(),
            file: new File([blob], "audio.dat", {type: "application/octet-stream"})
        }));

export const fetchJson = params =>
        post(params).then(res => res.json());