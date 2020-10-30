This repo contains an AWS Lambda function in the Node runtime which you can use to poll PagerDuty's REST API every hour for audit records and send them to a Sumo Logic HTTP collector. You can modify these steps to work with other clouds or to change the polling frequency.

### Setting up the function in Lambda

For convinience, we've included a zip archive you can upload directly to AWS Lambda. Steps may vary depending on how your AWS account is structured.

1. In the **Function Code** section, go to the **Actions** menu and select **Upload a .zip file**.
2. Create an S3 bucket
3. Create an environenment variable on your Lambda function called `state_bucket` and put in the name of your bucket as the value
3. Give your Lambda execution role access to your S3 bucket
* If you're comfortable, you can add the existing `AmazonS3FullAccess` to your execution role
* Alternatively, [create a custom policy](https://aws.amazon.com/premiumsupport/knowledge-center/lambda-execution-role-s3-bucket/) with read/write access to your bucket and assign it to the exection role.
4. Create an environment variable called `pagerduty_global_api_token` and put in a read-only PagerDuty Global API key ([only an admin can generate this key](https://support.pagerduty.com/docs/generating-api-keys#generating-a-general-access-rest-api-key).
5. [Create an HTTP collector in Sumo Logic](https://help.sumologic.com/03Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source#configure-an-http%C2%A0logs-and-metrics-source)
6. Create an environment variable called `sumologic_endpoint` and paste in the **HTTP Source Address** from the Sumo Logic connector.
7. Create a Cloud Watch trigger for the AWS Lambda function which runs every hour.
