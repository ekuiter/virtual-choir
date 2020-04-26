<?php

header("Content-Type: application/javascript");

$config = file_get_contents("../config.json");
$version = filemtime("..");

echo <<<JS
    window.server = window.server || {};
    window.server.config = $config;
    window.server.version = new Date($version * 1000);
JS;

?>