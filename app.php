<?php

require_once "db.class.php";

if (file_exists("local.php"))
    require_once "local.php";
else {
    DB::$host = $_ENV["RDS_HOSTNAME"];
    DB::$user = $_ENV["RDS_USERNAME"];
    DB::$password = $_ENV["RDS_PASSWORD"];
    DB::$dbName = $_ENV["RDS_DB_NAME"];
}

$sql = <<<SQL
    CREATE TABLE IF NOT EXISTS `tracks` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `register` varchar(255) NOT NULL,
        `song` varchar(255) NOT NULL,
        `offset` varchar(255) NOT NULL,
        `gain` varchar(255) NOT NULL,
        `md5` varchar(255) NOT NULL,
        `date` varchar(255) NOT NULL,
        PRIMARY KEY (`id`)
    );
SQL;
DB::query($sql);

if ($_FILES) {
    $tmp_name = $_FILES["file"]["tmp_name"];
    $md5 = md5_file($tmp_name);
    @mkdir("tracks");
    move_uploaded_file($tmp_name, "tracks/" . $md5 . ".dat");
    DB::query("INSERT INTO tracks (name, register, song, offset, gain, date, md5) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["register"], $_POST["song"], $_POST["offset"],  $_POST["gain"], $_POST["date"], $md5);
    die;
}

if ($_REQUEST) {
    if (isset($_REQUEST["mix-from"]) && isset($_REQUEST["mix-to"])) {
        $playback = isset($_REQUEST["playback"]);
        $from = $_REQUEST["mix-from"];
        $to = $_REQUEST["mix-to"];
        $tracks = DB::query("SELECT * FROM tracks WHERE date >= %s AND date <= %s", $from, $to);
        $count = count($tracks);
        if ($count === 0)
            die('no tracks found');
        $song = basename($tracks[0]["song"], ".mp3");
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
        foreach ($tracks as $track)
            $command .= " -i \"tracks/$track[md5].dat\"";
        $command .= " -filter_complex \"";
        foreach ($tracks as $idx => $track) {
            if ($playback)
                $idx++;
            $offset = (float) $track["offset"];
            if ($offset >= 0) {
                $offset = number_format($offset, 4, ".", "");
                $offset = "atrim=start=$offset";
            } else {
                $offset *= -1;
                $offset = (int) ($offset * 1000);
                $offset = "adelay=delays=${offset}|${offset}";
            }
            $gain = number_format((float) $track["gain"], 4, ".", "");
            $command .= "[$idx]aresample=44100,aformat=channel_layouts=stereo,volume=${gain},${offset}[${idx}_out];";
        }
        if ($playback)
            $command .= "[0]";
        foreach ($tracks as $idx => $track) {
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
        DB::query("TRUNCATE TABLE tracks");
        array_map("unlink", array_filter((array) glob("tracks/*")));
        array_map("unlink", array_filter((array) glob("mixes/*")));
    }

    if (isset($_REQUEST["set-offset"]) && isset($_REQUEST["offset"]))
        DB::query("UPDATE tracks SET offset = %s WHERE id = %i", $_REQUEST["offset"], (int) $_REQUEST["set-offset"]);
    if (isset($_REQUEST["set-gain"]) && isset($_REQUEST["gain"]))
        DB::query("UPDATE tracks SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["set-gain"]);
}

?>