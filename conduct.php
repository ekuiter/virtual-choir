<?php

define("INCLUDE_APP", 1);
require_once "app.php";

$songs = array_slice(scandir("songs"), 2);
$selected_song = DB::queryFirstRow("SELECT * FROM options WHERE `key` = 'song'");
$none_selected = !$selected_song ? "selected" : "";
$song_options = "<option value=\"null\" $none_selected>Song auswählen</option>\n";
foreach ($songs as $song) {
    $selected = $selected_song && $selected_song["value"] === $song ? "selected" : "";
    $song_options .= "<option value=\"$song\" $selected>$song</option>\n";
}

$playback_checked = DB::queryFirstRow("SELECT * FROM options WHERE `key` = 'playback' AND `value` = 'true'")
    ? "checked"
    : "";

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
                <li class="nav-item active">
                    <a class="nav-link" href="conduct.php">Dirigieren</a>
                </li>
                <li class="nav-item">
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
        <h4>Neue Aufnahme</h4>

        <form id="conduct" class="my-2 my-lg-0">
            <div class="form-check form-check-inline" style="margin: 10px 0;">
                <input class="form-check-input" type="checkbox" id="playback" <?php echo $playback_checked; ?>>
                <label class="form-check-label" for="playback">Während der Aufnahme bei den Teilnehmern abspielen</label>
            </div>
            <div class="form-group form-inline">
                <select class="custom-select" class="form-control mr-sm-2" id="songs" style="margin-right: 6px;">
                    <?php echo $song_options; ?>
                </select>
                <input type="submit" class="btn btn-outline-primary my-2 my-sm-0" value="Aufnehmen!">
                <button id="status" class="btn" onclick="return false" style="color: darkred;"></button>
            </div>
        </form>

        <br>
        <h4>Aktuelle Teilnehmer</h4>

        <table class="table table-striped table-borderless table-sm">
            <thead>
                <tr>
                    <th style="width: 50%;">Name</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="participants">
            </tbody>
        </table>
    </div>
    <script src="https://code.jquery.com/jquery-3.4.1.slim.min.js" integrity="sha384-J6qa4849blE2+poT4WnyKhv5vZF5SrPo0iEjwBvKU7imGFAV0wwj1yYfoRSJoZ+n" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js" integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js" integrity="sha384-wfSDF2E50Y2D1uUdj0O3uMBJnjuUD4Ih7YwaYd1iqfktj0Uod8GCExl3Og8ifwB6" crossorigin="anonymous"></script>
    <script src="app.js"></script>
    <script>
        initializeConduct();
    </script>
</body>
</html>