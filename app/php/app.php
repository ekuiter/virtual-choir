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

$config = json_decode(file_get_contents("../../config.json"));

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

function ffmpeg() {
    if (strlen(shell_exec("ffmpeg -version")))
        $ffmpeg = "ffmpeg";
    else if (strlen(shell_exec("./ffmpeg -version")))
        $ffmpeg = "./ffmpeg";
    else
        die("no ffmpeg found");
    return $ffmpeg;
}

function audiowaveform() {
    if (strlen(shell_exec("audiowaveform --version")))
        $audiowaveform = "audiowaveform";
    else if (strlen(shell_exec("./audiowaveform --version")))
        $audiowaveform = "./audiowaveform";
    else
        die("no audiowaveform found");
    return $audiowaveform;
}

function xml2abc() {
    if (strlen(shell_exec("xml2abc --version")))
        $xml2abc = "xml2abc";
    else if (strlen(shell_exec("./xml2abc --version")))
        $xml2abc = "./xml2abc";
    else if (strlen(shell_exec("python xml2abc.py --version")))
        $xml2abc = "python xml2abc.py";
    else
        die("no xml2abc found");
    return $xml2abc;
}

function do_reset() {
    DB::query("DROP TABLE tracks");
    array_map("unlink", array_filter((array) glob("../tracks/*")));
    array_map("unlink", array_filter((array) glob("../mixes/*")));
}

function basenameMp3($mix) {
    return basename($mix, ".mp3");
}

function map($x, $in_min, $in_max, $out_min, $out_max) {
    return ($x - $in_min) * ($out_max - $out_min) / ($in_max - $in_min) + $out_min;
}

if (@$config->useAudiowaveform) {
    $songs = array_filter((array) glob("../songs/*.mp3"));
    foreach ($songs as $song) {
        $song = basename($song, ".mp3");
        if (!file_exists("../songs/$song.json"))
            shell_exec(audiowaveform() . " -b 8 -i \"../songs/$song.mp3\" -o \"../songs/$song.json\"");
    }
}

if (@$config->useXml2Abc) {
    $songs = array_filter((array) glob("../songs/*.musicxml"));
    foreach ($songs as $song) {
        $song = basename($song, ".musicxml");
        if (!file_exists("../songs/$song.abc"))
            shell_exec(xml2abc() . " \"../songs/$song.musicxml\" > \"../songs/$song.abc\"");
    }
}

if ($_FILES && isset($_FILES["file"]) && $_FILES["file"]["error"] === 0) {
    $tmp_name = $_FILES["file"]["tmp_name"];
    $md5 = md5_file($tmp_name);
    @mkdir("../tracks");
    shell_exec(ffmpeg() . " -i $tmp_name \"../tracks/$md5.mp3\"");
    if (@$config->useAudiowaveform)
        shell_exec(audiowaveform() . " -b 8 -i \"../tracks/$md5.mp3\" -o \"../tracks/$md5.json\"");
    DB::query("INSERT INTO tracks (name, register, song, songOffset, recordingOffset, gain, date, md5) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["register"], $_POST["song"], $_POST["songOffset"], $_POST["recordingOffset"], $_POST["gain"], $_POST["date"], $md5);
    die;
}

if (isset($_REQUEST["config"])) {
    header("Content-Type: application/json");
    $config->version = filemtime("..") * 1000;
    echo json_encode($config);
}

if (isset($_REQUEST["mixes"])) {
    header("Content-Type: application/json");
    $mixes = file_exists("../mixes") ? array_map("basenameMp3", array_filter((array) glob("../mixes/*"))) : array();
    rsort($mixes);
    echo json_encode($mixes);
}

if (isset($_REQUEST["tracks"])) {
    header("Content-Type: application/json");
    echo json_encode(DB::query("SELECT * FROM tracks ORDER BY date DESC"));
}

if (isset($_REQUEST["mix"])) {
    $playback = isset($_REQUEST["playback"]);
    $track_ids = json_decode($_REQUEST["mix"]);
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
    $track_id_by_register = array();
    if (!file_exists("../songs/$song.mp3"))
        die("invalid song");
    $mixfile = "../mixes/" . date("Y-m-d H-i-s") . " $song (" . ($playback ? "Playback, " : "");
    foreach ($tracks as $idx => $track) {
        if ($track["register"] === "null")
            continue;
        if (!@$config->registers->{$track["register"]})
            die("invalid register");
        if (!is_numeric($track["recordingOffset"]) || !is_numeric($track["songOffset"]) || !is_numeric($track["gain"]))
            die("invalid offset/gain");
        if (array_key_exists($track["register"], $track_id_by_register))
            $track_id_by_register[$track["register"]][] = (int) $track["id"];
        else
            $track_id_by_register[$track["register"]] = array((int) $track["id"]);
    }
    ksort($track_id_by_register);
    foreach ($track_id_by_register as $register => &$_tracks) {
        sort($_tracks);
        $mixfile .= count($_tracks) . "x $register, ";
    }
    if (substr($mixfile, -2) === ", ")
        $mixfile = substr($mixfile, 0, -2);
    $command = ffmpeg() . " -y";
    if ($playback)
        $command .= " -i \"../songs/$song.mp3\"";
    foreach ($tracks as $track)
        $command .= " -i \"../tracks/$track[md5].mp3\"";
    $command .= " -filter_complex \"";
    $balance_by_track_id_and_name = array();
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
        $balance = $track["register"] !== "null" ? @$config->registers->{$track["register"]}->balance : 0.0;
        if (!$balance)
            $balance = 0.0;
        $variance = $track["register"] !== "null" ? @$config->registers->{$track["register"]}->variance : 0.0;
        if (!$variance)
            $variance = 0.0;
        if ($track["register"] !== "null") {
            $num_by_register = count($track_id_by_register{$track["register"]});
            $idx_by_register = array_search((int) $track["id"], $track_id_by_register{$track["register"]});
            $my_balance = $num_by_register > 1
                ? map($idx_by_register, 0, $num_by_register - 1, $balance - $variance, $balance + $variance)
                : $balance;
        } else
            $my_balance = 0.0;
        $balance_by_track_id_and_name[$track["id"] . "," . $track["name"]] = $my_balance;
        $command .= "[$idx]aresample=44100,aformat=channel_layouts=stereo,stereotools=balance_out=$my_balance,volume=${gain},${offset}[${idx}_out];";
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
    @mkdir("../mixes");
    asort($balance_by_track_id_and_name);
    $track_ids_and_names = array_keys($balance_by_track_id_and_name);
    foreach ($track_ids_and_names as &$id_and_name)
        $id_and_name = preg_replace("/[^a-zA-Z0-9]+/", "", implode(",", array_slice(explode(",", $id_and_name), 1)));
    $mixfile .= " - " . implode(", ", $track_ids_and_names) . ").mp3";
    if (@$config->simplifiedMixTitle)
        $mixfile = "../mixes/$song " . date("Y-m-d") . ".mp3";
    $gain = isset($_REQUEST["gain"]) ? $_REQUEST["gain"] : 1;
    $command .= "amix=inputs=$count:duration=longest,volume=$gain\" \"$mixfile\"";
    shell_exec($command);
    $mixfile = base64_encode(basename($mixfile, ".mp3"));
    header("Location: ../listen/$mixfile");
    die;
}

if (isset($_REQUEST["reset"]))
    do_reset();

if (isset($_REQUEST["deleteSelected"])) {
    $track_ids = json_decode($_REQUEST["deleteSelected"]);
    if (!$track_ids)
        die("no tracks given");
    $where = new WhereClause("or");
    foreach ($track_ids as $track_id)
        $where->add("id=%i", (int) $track_id);
    $tracks = DB::query("SELECT * FROM tracks WHERE %l", $where);
    $count = count($tracks);
    if ($count === 0)
        die("no tracks found");
    foreach ($tracks as $idx => $track) {
        unlink("../tracks/$track[md5].mp3");
        if (@$config->useAudiowaveform)
            unlink("../tracks/$track[md5].json");
    }
    DB::query("DELETE FROM tracks WHERE %l", $where);
}

if (isset($_REQUEST["renameMix"]) && isset($_REQUEST["to"]) && @$config->renameMixTitle) {
    $mix = $_REQUEST["renameMix"];
    $to = $_REQUEST["to"];
    if (!$mix || !$to)
        die("no mix given");
    if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
        die("invalid mix");
    rename("../mixes/$mix.mp3", "../mixes/$to.mp3"); // only enable this when users can be trusted!
}

if (isset($_REQUEST["deleteMix"])) {
    $mix = $_REQUEST["deleteMix"];
    if (!$mix)
        die("no mix given");
    if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
        die("invalid mix");
    unlink("../mixes/$mix.mp3");
}

if (isset($_REQUEST["backup"])) {
    @mkdir("../tracks");
    @mkdir("../mixes");
    if ($_FILES && isset($_FILES["restore"]) && $_FILES["restore"]["error"] === 0) {
        $tempdir = tempnam(sys_get_temp_dir(), "");
        if (file_exists($tempdir))
            unlink($tempdir);
        mkdir($tempdir);
        $zip = new ZipArchive();
        if (!$zip->open($_FILES["restore"]["tmp_name"]))
            die("invalid zip file given");
        $zip->extractTo($tempdir);
        $zip->close();
        if (!file_exists("$tempdir/dump.sql"))
            die("no database dump found");
        do_reset();
        $tracks = array_filter((array) glob("$tempdir/tracks/*.mp3"));
        foreach ($tracks as $track)
            rename($track, "../tracks/" . basename($track));
        if (@$config->useAudiowaveform) {
            $tracks = array_filter((array) glob("$tempdir/tracks/*.json"));
            foreach ($tracks as $track)
                rename($track, "../tracks/" . basename($track));
        }
        $mixes = array_filter((array) glob("$tempdir/mixes/*.mp3"));
        foreach ($mixes as $mix)
            rename($mix, "../mixes/" . basename($mix));
        shell_exec("mysql -h " . DB::$host . " -u " . DB::$user . " -p" . DB::$password . " " . DB::$dbName . " < $tempdir/dump.sql");
        header("Location: ../admin");
    } else {
        $zipfile = "../backups/backup-" . date("Y-m-d-H-i-s") . ".zip";
        $zip = new ZipArchive();
        if (!$zip->open($zipfile, ZipArchive::CREATE))
            die("could not open ZIP file");
        $sql = shell_exec("mysqldump -h " . DB::$host . " -u " . DB::$user . " -p" . DB::$password . " " . DB::$dbName);
        $zip->addFromString("dump.sql", $sql);
        $tracks = array_filter((array) glob("../tracks/*"));
        foreach ($tracks as $track)
            $zip->addFile($track, "tracks/" . basename($track));
        $mixes = array_filter((array) glob("../mixes/*"));
        foreach ($mixes as $mix)
            $zip->addFile($mix, "mixes/" . basename($mix));
        $zip->close();
        header("Location: $zipfile");
    }
}

if (isset($_REQUEST["setFor"]) && isset($_REQUEST["songOffset"]))
    DB::query("UPDATE tracks SET songOffset = %s WHERE id = %i", $_REQUEST["songOffset"], (int) $_REQUEST["setFor"]);
if (isset($_REQUEST["setFor"]) && isset($_REQUEST["recordingOffset"]))
    DB::query("UPDATE tracks SET recordingOffset = %s WHERE id = %i", $_REQUEST["recordingOffset"], (int) $_REQUEST["setFor"]);
if (isset($_REQUEST["setFor"]) && isset($_REQUEST["gain"]))
    DB::query("UPDATE tracks SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["setFor"]);

?>