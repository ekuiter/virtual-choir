## Virtual Choir

![Screenshot](screenshot.jpg)

Coordinates voice recordings and synchronized mixes in virtual choirs.

### XAMPP setup instructions

This works out of the box with XAMPP (`AllowEncodedSlashes On`) by accessing `http://[::1]/` in the browser (make sure `ffmpeg`, `mysql`, and `mysqldump` are installed).

### AWS setup instructions

This will set up a virtual choir on AWS EC2 with a Let's Encrypt certificate.
A custom domain is required because `MediaDevices.getUserMedia()` only works with HTTPS.

- `git clone https://github.com/ekuiter/virtual-choir.git && cd virtual-choir`
- `npm install && npm run build`
- Rename `config.template.json` to `config.json` and update the songs you want to sing, their starting offsets, and voice registers for stereo balancing.
- For each song, supply an MP3 file (and optionally, MSCZ, PDF, and MusicXML files) in the `app/songs` directory.
  Such files can generated with [MuseScore](https://musescore.org) or [bemuse](https://github.com/ekuiter/bemuse)).
- Generate an `app/.htpasswd` file with some login credentials.
- Create an [AWS](https://aws.amazon.com) account and a user with AdministratorAccess in the [IAM console](https://console.aws.amazon.com/iam/home#/users).
- Install [EB CLI](https://github.com/aws/aws-elastic-beanstalk-cli-setup).
- `eb init --platform "PHP 7.3 running on 64bit Amazon Linux" --region "eu-central-1"`
- `eb create virtual-choir --single --database --database.engine "mysql" --database.username "<username>" --database.password "<password>" --envvars "CERT_DOMAIN=<custom-domain>"`
- Take note of the `CNAME` field in `eb status`.
- `eb ssh -c "wget https://dl.eff.org/certbot-auto; chmod a+x certbot-auto; sudo ./certbot-auto certonly --debug --manual --preferred-challenges dns --email <your-email-address> --domains <custom-domain>"`
- You may need to press `y` and `Enter` after installing dependencies. Then agree to the terms and IP logging.
- Take note of the `TXT` field, create according `CNAME` and `TXT` DNS records for your custom domain, wait a few seconds to minutes for the DNS update, and press `Enter`.
- Restart Apache with `eb deploy`.
- For subsequent deploys, you can migrate existing data with `npm run build && curl -L --user <user>:<password> https://<custom-domain>/php/app.php?backup --output backup.zip && eb deploy && curl -F "restore=@backup.zip" --user <user>:<password> https://<custom-domain>/php/app.php?backup`.

### Benchmarking

Use ApacheBench to simulate `n` users with `c` concurrent requests:

```
# use C:\xampp\apache\bin\abs.exe on Windows
ab -n 100 -c 50 -A <user>:<password> https://<custom-domain>/
```

To simulate recordings, use a hex editor to insert an OGG file into `ab.txt` (this can fail on Windows, in which case you should use wsl with `apache2-utils`):

```
ab -n 100 -c 50 -A <user>:<password> -p ab.txt -T "multipart/form-data; boundary=1234567890" https://<custom-domain>/php/app.php
```