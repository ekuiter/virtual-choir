<?php

header("Content-Type: application/javascript");

$songs = file_get_contents("../songs/songs.json");

echo <<<JS
    const songs = $songs;
JS;

?>