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

function getRegisterColor($img, $register, $default) {
    global $config;
    if (!@$config->registers->{$register} || !@$config->registers->{$register}->color)
        return $default;
    else {
        list($r, $g, $b) = sscanf(@$config->registers->{$register}->color, "#%02x%02x%02x");
        return imagecolorallocate($img, (int) $r, (int) $g, (int) $b);
    }
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
    $songOffset = $_POST["songOffset"] && $_POST["songOffset"] !== "undefined" ? $_POST["songOffset"] : "0.0";
    $recordingOffset = $_POST["recordingOffset"] && $_POST["recordingOffset"] !== "undefined" ? $_POST["recordingOffset"] : "0.0";
    $gain = $_POST["gain"] && $_POST["gain"] !== "undefined" ? $_POST["gain"] : "1.0";
    $date = $_POST["date"] && $_POST["date"] !== "undefined" ? $_POST["date"] : date("Y-m-d\TH:i:s.000\Z");
    DB::query("INSERT INTO tracks (name, register, song, songOffset, recordingOffset, gain, date, md5) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        $_POST["name"], $_POST["register"], $_POST["song"], $songOffset, $recordingOffset, $gain, $date, $md5);
    header("Location: ../admin");
}

if (isset($_REQUEST["config"])) {
    header("Content-Type: application/json");
    $config->version = filemtime("..") * 1000;
    echo json_encode($config);
}

if (isset($_REQUEST["mixes"])) {
    header("Content-Type: application/json");
    $mixes = file_exists("../mixes") ? array_map("basenameMp3", array_filter((array) glob("../mixes/*.mp3"))) : array();
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
    if (!@$config->songs->{$song})
        die("invalid song");
    $mixfile = "../mixes/" . date("Y-m-d") . " $song" . ($playback ? " (Playback)" : "");
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
    foreach ($track_id_by_register as $register => &$_tracks)
        sort($_tracks);
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
    $mixfile .= ".mp3";
    if (@$config->simplifiedMixTitle)
        $mixfile = "../mixes/$song " . date("Y-m-d") . ".mp3";
    $gain = isset($_REQUEST["gain"]) ? $_REQUEST["gain"] : 1;
    $command .= "amix=inputs=$count:duration=longest,volume=$gain\" \"$mixfile\"";
    shell_exec($command);
    if (count($track_id_by_register) > 0) {
        $width = 1600;
        $height = 400;
        $arc_x = $width / 2;
        $arc_y = $height + 40;
        $arc_width = $width - 50;
        $arc_height = $height;
        $pt = 35;
        $dot = 35;
        $img = imagecreatetruecolor($width * 2, $height * 2);
        $black = imagecolorallocate($img, 0, 0, 0);
        $gray = imagecolorallocate($img, 128, 128, 128);
        $white = imagecolorallocate($img, 255, 255, 255);
        imagefill($img, 0, 0, $white);
        imageantialias($img, true);
        imagesetthickness($img, 2);
        imagearc($img, $arc_x * 2, $arc_y * 2, $arc_width * 2, $arc_height * 4, 190, -10, $gray);
        foreach (array_keys($track_id_by_register) as $idx => $register) {
            $text = count($track_id_by_register[$register]) . "x $register";
            $bbox = imagettfbbox($pt, 0, realpath("arial.ttf"), $text);
            $text_width = $bbox[4] - $bbox[0];
            $text_x = map(@$config->registers->{$register}->balance, -1, 1, 0, $width * 2) - $text_width / 2;
            $text_y = $height * 2 - $pt * 2;
            imagettftext($img, $pt, 0, $text_x + 1, $text_y + 1, $gray, realpath("arial.ttf"), $text);
            imagettftext($img, $pt, 0, $text_x, $text_y, getRegisterColor($img, $register, $black), realpath("arial.ttf"), $text);
        }
        foreach ($balance_by_track_id_and_name as $track_id_and_name => $balance) {
            $id = explode(",", $track_id_and_name)[0];
            $_track = null;
            foreach ($tracks as $track)
                if ($track["id"] === $id)
                    $_track = $track;
            $color = $_track ? getRegisterColor($img, $_track["register"], $black) : $black;
            $_balance = (float) $balance * (@$config->registerScale ? @$config->registerScale : 1.0);
            $x = $arc_x * 2 + $_balance * $arc_width;
            $y = $arc_y * 2 - sin(acos($_balance)) * $arc_height * 2;
            $text = explode(",", $track_id_and_name)[1];
            $bbox = imagettfbbox($pt, 0, realpath("arial.ttf"), $text);
            $text_width = $bbox[4] - $bbox[0];
            $text_height = $bbox[1] - $bbox[7];
            $x_off = ($_balance < 0 ? $dot : (-1) * ($text_width + $dot));
            $text_x = $x + (abs($_balance) < 0.4 ? (-1) * ($text_width / 2) : $x_off);
            $text_y = $y + (abs($_balance) < 0.4 ? $text_height * 1.7 : $text_height / 2);
            imagefilledellipse($img, $x, $y, $dot, $dot, $color);
            imagettftext($img, $pt, 0, $text_x + 1, $text_y + 1, $gray, realpath("arial.ttf"), $text);
            imagettftext($img, $pt, 0, $text_x, $text_y, $color, realpath("arial.ttf"), $text);
        }
        $final_img = imagecreatetruecolor($width, $height);
        imagecopyresampled($final_img, $img, 0, 0, 0, 0, $width, $height, $width * 2, $height * 2);
        //header("Content-Type: image/png");
        //imagepng($final_img);
        imagepng($final_img, "../mixes/" . basename($mixfile, ".mp3") . ".png");
        imagedestroy($img);
        imagedestroy($final_img);
    }
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
    // only enable this when users can be trusted!
    $mix = $_REQUEST["renameMix"];
    $to = $_REQUEST["to"];
    if (!$mix || !$to)
        die("no mix given");
    if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
        die("invalid mix");
    rename("../mixes/$mix.mp3", "../mixes/$to.mp3");
    if (file_exists("../mixes/$mix.png"))
        rename("../mixes/$mix.png", "../mixes/$to.png");
}

if (isset($_REQUEST["deleteMix"])) {
    $mix = $_REQUEST["deleteMix"];
    if (!$mix)
        die("no mix given");
    if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
        die("invalid mix");
    unlink("../mixes/$mix.mp3");
    if (file_exists("../mixes/$mix.png"))
        unlink("../mixes/$mix.png");
}

if (isset($_REQUEST["encodeMix"]) && $_REQUEST["encodeMix"] && file_exists("background.png")) {
    $mix = $_REQUEST["encodeMix"];
    if (!$mix)
        die("no mix given");
    if (!file_exists("../mixes/$mix.mp3") || strpos(realpath("../mixes/$mix.mp3"), realpath("../mixes/")) !== 0)
        die("invalid mix");
    set_time_limit(0);
    shell_exec(ffmpeg() . " -y -loop 1 -i background.png -i \"../mixes/$mix.mp3\" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest mix.mp4");
    header("Location: mix.mp4");
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
        $mixes = array_filter((array) glob("$tempdir/mixes/*.png"));
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

if (isset($_REQUEST["setFor"]) && $_REQUEST["setFor"]) {
    if (isset($_REQUEST["name"]) && $_REQUEST["name"] !== "")
        DB::query("UPDATE tracks SET name = %s WHERE id = %i", $_REQUEST["name"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["song"]) && $_REQUEST["song"] !== "")
        DB::query("UPDATE tracks SET song = %s WHERE id = %i", $_REQUEST["song"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["register"]) && $_REQUEST["register"] !== "")
        DB::query("UPDATE tracks SET register = %s WHERE id = %i", $_REQUEST["register"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["songOffset"]) && $_REQUEST["songOffset"] !== "")
        DB::query("UPDATE tracks SET songOffset = %s WHERE id = %i", $_REQUEST["songOffset"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["recordingOffset"]) && $_REQUEST["recordingOffset"] !== "")
        DB::query("UPDATE tracks SET recordingOffset = %s WHERE id = %i", $_REQUEST["recordingOffset"], (int) $_REQUEST["setFor"]);
    if (isset($_REQUEST["gain"]) && $_REQUEST["gain"] !== "")
        DB::query("UPDATE tracks SET gain = %s WHERE id = %i", $_REQUEST["gain"], (int) $_REQUEST["setFor"]);
    header("Location: ../admin");
}

?>