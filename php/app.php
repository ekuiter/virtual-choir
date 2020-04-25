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
        $config = json_decode(file_get_contents("../config.json"));
        $playback = isset($_REQUEST["playback"]);
        $track_ids = json_decode(base64_decode($_REQUEST["mix"]))[1];
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
        $register_counts = array();
        if (!file_exists("../songs/$song.mp3"))
            die("invalid song");
        $mixfile = "../mixes/" . date("Y-m-d-H-i-s") . " $song (";
        foreach ($tracks as $idx => $track) {
            if (!@$config->registers->{$track["register"]})
                die("invalid register");
            if (!is_numeric($track["recordingOffset"]) || !is_numeric($track["songOffset"]) || !is_numeric($track["gain"]))
                die("invalid offset/gain");
            if (array_key_exists($track["register"], $register_counts))
                $register_counts[$track["register"]]++;
            else
                $register_counts[$track["register"]] = 1;
        }
        foreach ($register_counts as $register => $_count)
            $mixfile .= "$_count $register, ";
        $mixfile = substr($mixfile, 0, -2);
        $mixfile .= ").mp3";
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
            $balance = @$config->registers->{$track["register"]}->balance;
            if (!$balance)
                $balance = 0;
            $command .= "[$idx]aresample=44100,aformat=channel_layouts=stereo,stereotools=balance_out=$balance,volume=${gain},${offset}[${idx}_out];";
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
        $gain = isset($_REQUEST["gain"]) ? $_REQUEST["gain"] : 1;
        $command .= "amix=inputs=$count:duration=longest,volume=$gain\" \"$mixfile\"";
        @mkdir("../mixes");
        shell_exec($command);
        $mixfile = base64_encode(basename($mixfile, ".mp3"));
        header("Location: ../listen.html#$mixfile");
        die;
    }

    if (isset($_REQUEST["deleteSelected"])) {
        $track_ids = json_decode(base64_decode($_REQUEST["deleteSelected"]));
        if (!$track_ids)
            die("no tracks given");
        $where = new WhereClause("or");
        foreach ($track_ids as $track_id)
            $where->add("id=%i", (int) $track_id);
        $tracks = DB::query("SELECT * FROM tracks WHERE %l", $where);
        $count = count($tracks);
        if ($count === 0)
            die("no tracks found");
        foreach ($tracks as $idx => $track)
            unlink("../tracks/$track[md5].dat");
        DB::query("DELETE FROM tracks WHERE %l", $where);
    }

    if (isset($_REQUEST["deleteMix"])) {
        $mix = base64_decode($_REQUEST["deleteMix"]);
        if (!$mix)
            die("no mix given");
        if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
            die("invalid mix");
        unlink("../mixes/$mix.mp3");
    }

    if (isset($_REQUEST["reset"])) {
        DB::query("DROP TABLE tracks");
        array_map("unlink", array_filter((array) glob("../tracks/*")));
        array_map("unlink", array_filter((array) glob("../mixes/*")));
    }

    if (isset($_REQUEST["setFor"]) && isset($_REQUEST["songOffset"]))
        DB::query("UPDATE tracks SET songOffset = %s WHERE id = %i", $_REQUEST["songOffset"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["setFor"]) && isset($_REQUEST["recordingOffset"]))
        DB::query("UPDATE tracks SET recordingOffset = %s WHERE id = %i", $_REQUEST["recordingOffset"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["setFor"]) && isset($_REQUEST["gain"]))
        DB::query("UPDATE tracks SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["setFor"]);
}

?>