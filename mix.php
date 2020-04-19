<?php

require_once "app.php";

$tracks = json_encode(DB::query("SELECT * FROM tracks ORDER BY date DESC"));

?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="stylesheet" href="css/bootstrap.css">
    <link rel="stylesheet" href="css/bootstrap-slider.css" />
    <title>Virtueller Chor</title>
</head>
<body>
    <script>
        const tracks = <?php echo $tracks; ?>
            .map(({date, ...track}) => ({date: new Date(date), ...track}));
    </script>
    <script src="js/lib.js"></script>
    <script src="js/app.js"></script>
</body>
</html>