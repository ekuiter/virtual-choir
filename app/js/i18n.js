const translationMap = {
    en: {
        title: "Virtual Choir",
        language: "Language",
        en: "English",
        de: "Deutsch",
        record: "Record",
        mix: "Mix",
        listen: "Listen",
        admin: "Admin",
        stop: "Stop",
        play: "Play",
        volume: "Volume",
        name: "Your name",
        register: "Your register",
        song: "Which song?",
        score: "Score",
        playback: "Playback",
        nameMissing: "Please type in a name!",
        registerMissing: "Please choose a register!",
        songMissing: "Please choose a song!",
        testPermission: "Test permission",
        permissionMissing: "You did not grant the permission to start recording.",
        startRecording: "Start recording!",
        stopRecording: "Stop recording ...",
        recording: "Your recording",
        upload: "Upload",
        discard: "Discard",
        singleSong: "Please choose only recordings of a single song.",
        delete: "Delete",
        deleteSelected: "Delete selected",
        confirmDelete: "Sure? This will delete the recording.",
        confirmDeleteSelected: "Sure? This will delete the selected recordings.",
        microphoneSettings: "Microphone settings",
        browserSupport: "Browser support",
        info: "Info",
        nameHelp: "Your name so that you can identify your own recording.",
        registerHelp: "Determines your voice's balance when mixing to simulate a choir arrangement.",
        songHelp: "Choose the song you want to sing. This makes it easier to synchronize your recording.",
        scoreHelp: "Shows the song's sheet music while recording.",
        playbackHelp: "Plays the song in the background while recording.",
        saveChanges: "Save changes",
        confirmClose: "There are unsaved changes.",
        download: "Download",
        backupSection: "Backup & restore data",
        backup: "Backup",
        restore: "Restore",
        confirmRestore: "Sure? This will replace all recordings.",
        reset: "Reset",
        confirmReset: "Sure? This will delete all recordings.",
        notFound: "404 Not Found",
    },
    de: {
        title: "Virtueller Chor",
        language: "Sprache",
        en: "English",
        de: "Deutsch",
        record: "Aufnehmen",
        mix: "Abmischen",
        listen: "Anhören",
        admin: "Admin",
        stop: "Stoppen",
        play: "Abspielen",
        volume: "Lautstärke",
        name: "Dein Name",
        register: "Deine Stimmlage",
        song: "Welcher Song?",
        score: "Noten",
        playback: "Playback",
        nameMissing: "Bitte einen Namen eingeben!",
        registerMissing: "Bitte eine Stimmlage auswählen!",
        songMissing: "Bitte einen Song auswählen!",
        permissionMissing: "Erlaubnis zur Aufnahme wurde nicht erteilt.",
        testPermission: "Berechtigung testen",
        startRecording: "Aufnahme starten!",
        stopRecording: "Aufnahme stoppen ...",
        recording: "Deine Aufnahme",
        upload: "Hochladen",
        discard: "Verwerfen",
        singleSong: "Bitte nur Aufnahmen eines einzelnen Songs wählen.",
        delete: "Löschen",
        deleteSelected: "Auswahl löschen",
        confirmDelete: "Sicher? Dies löscht die Aufnahme.",
        confirmDeleteSelected: "Sicher? Dies löscht alle ausgewählten Aufnahmen.",
        microphoneSettings: "Mikrofon-Einstellungen",
        browserSupport: "Browser-Unterstützung",
        info: "Info",
        nameHelp: "Dein Name, damit du die Aufnahme später wiederfinden kannst.",
        registerHelp: "Bestimmt die Balance deiner Stimme beim Abmischen, um eine Choraufstellung zu simulieren.",
        songHelp: "Wähle den Song aus, den du singen möchtest, um das Synchronisieren deiner Aufnahme zu erleichtern.",
        scoreHelp: "Zeigt die Noten während der Aufnahme an.",
        playbackHelp: "Spielt den Song während der Aufnahme im Hintergrund ab.",
        saveChanges: "Änderungen speichern",
        confirmClose: "Nicht alle Änderungen wurden gespeichert.",
        download: "Herunterladen",
        backupSection: "Daten sichern & wiederherstellen",
        backup: "Sichern",
        restore: "Wiederherstellen",
        confirmRestore: "Sicher? Dies ersetzt alle Aufnahmen.",
        reset: "Zurücksetzen",
        confirmReset: "Sicher? Dies löscht alle Aufnahmen.",
        notFound: "404 Nicht gefunden",
    }
};

let defaultLanguage;

export const setDefaultLanguage = language => defaultLanguage = language;

export const setLanguage = language => {
    localStorage.setItem("language", language);
    location.reload();
};

export const getLanguages = () =>
    Object.keys(translationMap);

export const getLanguage = () =>
    localStorage.getItem("language") || defaultLanguage || "en";

export const t = key =>
    translationMap[getLanguage()][key] || translationMap.en[key];

export const formatDate = (date, sep = " ") =>
    ("0" + date.getDate()).slice(-2) + "." + ("0" + (date.getMonth() + 1)).slice(-2) + "." +
        sep + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);