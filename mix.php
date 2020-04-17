<?php

require_once "app.php";

$rows = DB::query("SELECT DISTINCT date, song FROM uploads ORDER BY date DESC");
$from = isset($_REQUEST["from"]) ? $_REQUEST["from"] : null;
$to = isset($_REQUEST["to"]) && $_REQUEST["to"] ? $_REQUEST["to"] : $from;
$none_selected = !$from ? "selected" : "";

function date_options($compare_date, $none_selected, $rows) {
    $date_options = "<option value=\"\" $none_selected>Aufnahme auswählen</option>\n";
    foreach ($rows as $row) {
        $selected = $compare_date === $row["date"] ? "selected" : "";
        $song = basename($row["song"], ".mp3");
        $date_options .= "<option value=\"$row[date]\" $selected>$row[date] $song</option>\n";
    }
    return $date_options;
}

$date_options_from = date_options($from, $none_selected, $rows);
$date_options_to = date_options($to, $none_selected, $rows);

$rows = DB::query("SELECT * FROM uploads WHERE date >= %s AND date <= %s", $from, $to);
$tracks = "";
foreach ($rows as $row) {
    $song = $row["song"];
    $tracks .= "<tr><td><button class=\"btn\" onclick=\"return false\" style=\"padding-left: 0;\">$row[name]</button></td>";
    $tracks .= "<td><form method=\"post\"><input type=\"hidden\" name=\"set-offset\" value=\"$row[id]\"><input type=\"text\" class=\"form-control\" name=\"offset\" value=\"$row[offset]\"></form></td>";
    $tracks .= "<td><form method=\"post\"><input type=\"hidden\" name=\"set-gain\" value=\"$row[id]\"><input type=\"text\" class=\"form-control\" name=\"gain\" value=\"$row[gain]\"></td></form></tr>\n";
    $tracks .= "<tr><td colspan=\"3\"><div class=\"wavesurfer\" id=\"wavesurfer-$row[id]\" data-file=\"$row[file]\" data-offset=\"$row[offset]\" data-gain=\"$row[gain]\"></div></td></tr>\n";
}

if ($from && $to && isset($song))
    $tracks_html = <<<HTML
        <br>
        <h4>Spuren</h4>
        <div style="margin: 10px 0.3rem;">
            <form action="app.php" method="post" class="form-inline">
                <input type="hidden" name="mix-from" value="$from">
                <input type="hidden" name="mix-to" value="$to">
                <input class="form-check-input" type="checkbox" id="playback" name="playback">
                <label class="form-check-label" for="playback" style="margin-right: 15px;">Playback</label>
                <button id="preview" class="btn btn-outline-primary" style="margin-right: 6px;" disabled>Abspielen</button>
                <input type="submit" class="btn btn-outline-success my-2 my-sm-0" value="Abmischen">
            </form>
        </div>
        <div id="loading">
            Lade Spuren ...
        </div>
        <div id="editing" style="display: none;">
            <table class="table table-borderless table-sm">
                <thead>
                    <tr>
                        <th style="width: 50%;">Name</th>
                        <th>Offset</th>
                        <th>Gain</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Playback</td><td><input type="text" class="form-control" value="0" disabled></td><td><input type="text" class="form-control" value="1" disabled></td></tr>
                    <tr><td colspan="3"><div id="songWavesurfer" data-song="$song"></div></td></tr>
                    $tracks
                </tbody>
            </table>
        </div>
    HTML;
else
    $tracks_html = "";

?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
    <title>Virtueller Chor</title>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <a class="navbar-brand" href="#">Virtueller Chor</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav mr-auto">
                <li class="nav-item">
                    <a class="nav-link" href="index.html">Mitsingen</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="conduct.php">Dirigieren</a>
                </li>
                <li class="nav-item active">
                    <a class="nav-link" href="mix.php">Abmischen</a>
                </li>
            </ul>
            <form id="reset" class="form-inline my-2 my-lg-0">
                <input type="submit" class="btn btn-danger my-2 my-sm-0" value="Zurücksetzen">
            </form>
        </div>
    </nav>
    <div class="container">
        <br>
        <h4>Aufnahmen</h4>

        <form method="get" id="date" class="form-inline my-2 my-lg-0" style="padding-top: 10px;">
                <label for="from" style="margin: 0 15px 0 0.3rem;">Von</label>
                <select id="dates-from" class="custom-select" class="form-control mr-sm-2" name="from" style="margin-right: 6px;">
                    <?php echo $date_options_from; ?>
                </select>
                <label for="from" style="margin: 0 15px;">Bis</label>
                <select id="dates-to" class="custom-select" class="form-control mr-sm-2" name="to" style="margin-right: 6px;">
                    <?php echo $date_options_to; ?>
                </select>
        </form>

        <?php echo $tracks_html; ?>
    </div>
    <script src="https://unpkg.com/wavesurfer.js"></script>
    <script src="https://unpkg.com/wavesurfer.js/dist/plugin/wavesurfer.regions.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.4.1.slim.min.js" integrity="sha384-J6qa4849blE2+poT4WnyKhv5vZF5SrPo0iEjwBvKU7imGFAV0wwj1yYfoRSJoZ+n" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js" integrity="sha384-wfSDF2E50Y2D1uUdj0O3uMBJnjuUD4Ih7YwaYd1iqfktj0Uod8GCExl3Og8ifwB6" crossorigin="anonymous"></script>
    <script src="app.js"></script>
    <script>
        initializeMix();
    </script>
</body>
</html>