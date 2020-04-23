<?php

header("Content-Type: application/javascript");

$version = filemtime("..");
$config = file_get_contents("../config.json");

echo <<<JS
    const version = new Date($version * 1000);
    const config = $config;
JS;

?>