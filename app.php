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
    CREATE TABLE IF NOT EXISTS `uploads` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `register` varchar(255) NOT NULL,
        `song` varchar(255) NOT NULL,
        `offset` varchar(255) NOT NULL,
        `gain` varchar(255) NOT NULL,
        `file` varchar(255) NOT NULL,
        `date` varchar(255) NOT NULL,
        PRIMARY KEY (`id`)
    );
SQL;
DB::query($sql);

if ($_FILES) {
    $tmp_name = $_FILES["file"]["tmp_name"];
    $file = md5_file($tmp_name) . ".dat";
    @mkdir("uploads");
    move_uploaded_file($tmp_name, "uploads/" . $file);
    DB::query("INSERT INTO uploads (name, register, song, offset, gain, date, file) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["register"], $_POST["song"], $_POST["offset"],  $_POST["gain"], $_POST["date"], $file);
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
                $offset = number_format($offset, 4, ".", "");
                $offset = "atrim=start=$offset";
            } else {
                $offset *= -1;
                $offset = (int) ($offset * 1000);
                $offset = "adelay=delays=${offset}|${offset}";
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
        DB::query("TRUNCATE TABLE uploads");
        array_map("unlink", array_filter((array) glob("uploads/*")));
        array_map("unlink", array_filter((array) glob("mixes/*")));
    }

    if (isset($_REQUEST["set-offset"]) && isset($_REQUEST["offset"]))
        DB::query("UPDATE uploads SET offset = %s WHERE id = %i", $_REQUEST["offset"], (int) $_REQUEST["set-offset"]);
    if (isset($_REQUEST["set-gain"]) && isset($_REQUEST["gain"]))
        DB::query("UPDATE uploads SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["set-gain"]);
}

?>