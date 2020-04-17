## Virtual Choir

Coordinates voice recordings and synchronized mixes in virtual choirs.

### Setup instructions

- Create a `.htpasswd` file, fill in `.ebextensions/https.config.template` with a [self-signed certificate](https://devcenter.heroku.com/articles/ssl-certificate-self) and rename it to `.ebextensions/https.config`.
- Create an [AWS](https://aws.amazon.com) account.
- Create an EC2 instance with Elastic Beanstalk (e.g., in the [Frankfurt region](https://eu-central-1.console.aws.amazon.com/elasticbeanstalk/home?region=eu-central-1#/gettingStarted)) with the platform settings *PHP*, *PHP 7.3 running on 64bit Amazon Linux*, *2.9.4*.
- Attach an [RDS DB instance](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_PHP.rds.html#php-rds-create)) to the environment.
- Install [EB CLI](https://github.com/aws/aws-elastic-beanstalk-cli-setup).
- In the Git repository, run `eb init` and follow the instructions.
- Then run `eb deploy` to deploy the application to Elastic Beanstalk.
- For debugging, you can use `eb ssh` (after creating a user with AdministratorAccess in the [IAM console](https://console.aws.amazon.com/iam/home#/users)).