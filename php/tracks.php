<?php

require_once "app.php";

header("Content-Type: application/javascript");

$tracks = json_encode(DB::query("SELECT * FROM tracks ORDER BY date DESC"));

echo <<<JS
    const tracks = $tracks.map(({date, ...track}) => ({date: new Date(date), ...track}));
JS;

?>