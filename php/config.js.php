<?php

header("Content-Type: application/javascript");

$config = file_get_contents("../config.json");

echo <<<JS
    const config = $config;
JS;

?>