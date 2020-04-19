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
        `songOffset` varchar(255) NOT NULL,
        `recordingOffset` varchar(255) NOT NULL,
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
    @mkdir("../tracks");
    move_uploaded_file($tmp_name, "../tracks/" . $md5 . ".dat");
    DB::query("INSERT INTO tracks (name, register, song, songOffset, recordingOffset, gain, date, md5) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["register"], $_POST["song"], $_POST["songOffset"], $_POST["recordingOffset"], $_POST["gain"], $_POST["date"], $md5);
    die;
}

if ($_REQUEST) {
    if (isset($_REQUEST["mix"])) {
        $playback = isset($_REQUEST["playback"]);
        $track_ids = json_decode(base64_decode($_REQUEST["mix"]));
        if (!$track_ids)
            die("no tracks given");
        $where = new WhereClause("or");
        foreach ($track_ids as $track_id)
            $where->add("id=%i", (int) $track_id);
        $tracks = DB::query("SELECT * FROM tracks WHERE %l", $where);
        $count = count($tracks);
        if ($count === 0)
            die("no tracks found");
        $song = $tracks[0]["song"];
        $mixfile = "../mixes/" . date("Y-m-d-H-i-s") . "-$song.mp3";
        if (strlen(shell_exec("ffmpeg -version")))
            $ffmpeg = "ffmpeg";
        else if (strlen(shell_exec("./ffmpeg -version")))
            $ffmpeg = "./ffmpeg";
        else
            die("no ffmpeg found");
        $command = "$ffmpeg -y";
        if ($playback)
            $command .= " -i \"../songs/$song.mp3\"";
        foreach ($tracks as $track)
            $command .= " -i \"../tracks/$track[md5].dat\"";
        $command .= " -filter_complex \"";
        foreach ($tracks as $idx => $track) {
            if ($playback)
                $idx++;
            $offset = ((float) $track["recordingOffset"]) - ((float) $track["songOffset"]);
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
        @mkdir("../mixes");
        shell_exec($command);
        header("Location: $mixfile");
        die;
    }

    if (isset($_REQUEST["reset"])) {
        DB::query("DROP TABLE tracks");
        array_map("unlink", array_filter((array) glob("../tracks/*")));
        array_map("unlink", array_filter((array) glob("../mixes/*")));
    }

    if (isset($_REQUEST["set-for"]) && isset($_REQUEST["songOffset"]))
        DB::query("UPDATE tracks SET songOffset = %s WHERE id = %i", $_REQUEST["songOffset"], (int) $_REQUEST["set-for"]);
    if (isset($_REQUEST["set-for"]) && isset($_REQUEST["recordingOffset"]))
        DB::query("UPDATE tracks SET recordingOffset = %s WHERE id = %i", $_REQUEST["recordingOffset"], (int) $_REQUEST["set-for"]);
    if (isset($_REQUEST["set-for"]) && isset($_REQUEST["gain"]))
        DB::query("UPDATE tracks SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["set-for"]);
}

?>