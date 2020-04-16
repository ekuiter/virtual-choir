<?php

require_once "db.class.php";

DB::$host = "";
DB::$user = "";
DB::$password = "";
DB::$dbName = "";

function setOption($key, $value) {
    if ($value === "null")
        DB::query("DELETE FROM options WHERE `key` = %s", $key);
    else
        DB::query("REPLACE INTO options (`key`, value) VALUES (%s, %s)", $key, $value);
}

if ($_FILES) {
    $tmp_name = $_FILES["file"]["tmp_name"];
    $file = md5_file($tmp_name) . ".dat";
    @mkdir("uploads");
    move_uploaded_file($tmp_name, "uploads/" . $file);
    DB::query("INSERT INTO uploads (name, date, offset, gain, song, file) VALUES (%s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["date"], $_POST["offset"], $_POST["gain"], $_POST["song"], $file);
    die;
}

if ($_REQUEST) {
    if (isset($_REQUEST["mix-from"]) && isset($_REQUEST["mix-to"])) {
        $playback = isset($_REQUEST["playback"]);
        $from = $_REQUEST["mix-from"];
        $to = $_REQUEST["mix-to"];
        $uploads = DB::query("SELECT * FROM uploads WHERE date >= %s AND date <= %s", $from, $to);
        $count = count($uploads);
        if ($count === 0)
            die('no uploads found');
        $song = basename($uploads[0]["song"], ".mp3");
        $mixfile = "mixes/$from-$song.mp3";

        if (strlen(shell_exec('ffmpeg -version')))
            $ffmpeg = "ffmpeg";
        else if (strlen(shell_exec('./ffmpeg -version')))
            $ffmpeg = "./ffmpeg";
        else
            die('no ffmpeg found');

        $command = "$ffmpeg -y";
        if ($playback)
            $command .= " -i \"songs/$song.mp3\"";
        foreach ($uploads as $upload)
            $command .= " -i \"uploads/$upload[file]\"";
        $command .= " -filter_complex \"";
        foreach ($uploads as $idx => $upload) {
            if ($playback)
                $idx++;
            $offset = (float) $upload["offset"];
            if ($offset >= 0) {
                $offset = (int) ($offset * 1000);
                $offset = "adelay=delays=${offset}|${offset}";
            } else {
                $offset *= -1;
                $offset = number_format($offset, 4, ".", "");
                $offset = "atrim=start=$offset";
            }
            $gain = number_format((float) $upload["gain"], 4, ".", "");
            $command .= "[$idx]aresample=44100,aformat=channel_layouts=stereo,volume=${gain},${offset}[${idx}_out];";
        }
        if ($playback)
            $command .= "[0]";
        foreach ($uploads as $idx => $upload) {
            if ($playback)
                $idx++;
            $command .= "[${idx}_out]";
        }
        if ($playback)
            $count++;
        $command .= "amix=inputs=$count:duration=longest\" \"$mixfile\"";
        @mkdir("mixes");
        shell_exec($command);
        header("Location: $mixfile");

        die;
    }

    if (isset($_REQUEST["reset"])) {
        DB::query("TRUNCATE TABLE participants");
        DB::query("TRUNCATE TABLE options");
        DB::query("TRUNCATE TABLE uploads");
        array_map("unlink", array_filter((array) glob("uploads/*")));
        array_map("unlink", array_filter((array) glob("mixes/*")));
    }

    if (isset($_REQUEST["name"]) && isset($_REQUEST["status"])) {
        if ($_REQUEST["status"] === "leave")
            DB::query("DELETE FROM participants WHERE name = %s", $_REQUEST["name"]);
        else
            DB::query("REPLACE INTO participants (name, status) VALUES (%s, %s)", $_REQUEST["name"], $_REQUEST["status"]);
    }

    if (isset($_REQUEST["song"]))
        setOption("song", $_REQUEST["song"]);
    if (isset($_REQUEST["start_at"]))
        setOption("start_at", $_REQUEST["start_at"]);
    if (isset($_REQUEST["stop_at"]))
        setOption("stop_at", $_REQUEST["stop_at"]);
    if (isset($_REQUEST["playback"]))
        setOption("playback", $_REQUEST["playback"]);

    if (isset($_REQUEST["set-offset"]) && isset($_REQUEST["offset"]))
        DB::query("UPDATE uploads SET offset = %s WHERE id = %i", $_REQUEST["offset"], (int) $_REQUEST["set-offset"]);
    if (isset($_REQUEST["set-gain"]) && isset($_REQUEST["gain"]))
        DB::query("UPDATE uploads SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["set-gain"]);
}

if (!defined("INCLUDE_APP")) {
    header("Access-Control-Allow-Origin: *");
    header("Content-Type: application/json");

    $state = array(
        "participants" => array(),
        "options" => array()
    );

    $participants = DB::query("SELECT * FROM participants");
    foreach ($participants as $participant)
        $state["participants"][$participant["name"]] = array(
            "status" => $participant["status"]
        );

    $options = DB::query("SELECT * FROM options");
    foreach ($options as $option)
        $state["options"][$option["key"]] = $option["value"];

    echo json_encode($state);
}

?>