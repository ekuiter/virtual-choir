export const post = params => {
    const data = new FormData();
    for (const key in params)
        data.append(key, params[key]);
    return window.fetch("php/app.php", {method: "POST", body: data});
};

export const uploadTrack = (blobUri, name, register, song, songOffset, recordingOffset, gain) =>
    fetch(blobUri)
        .then(res => res.blob())
        .then(blob => post({
            name, register, song, songOffset, recordingOffset, gain,
            date: (new Date).toISOString(),
            file: new File([blob], "audio.dat", {type: "application/octet-stream"})
        }));