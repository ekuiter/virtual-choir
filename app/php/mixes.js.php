<?php

require_once "app.php";

header("Content-Type: application/javascript");

function map($mix) {
    return basename($mix, ".mp3");
}

$mixes = file_exists("../mixes") ? array_map("map", array_filter((array) glob("../mixes/*"))) : array();
rsort($mixes);
$mixes = json_encode($mixes);

echo <<<JS
    window.server = window.server || {};
    window.server.mixes = $mixes;
JS;

?>