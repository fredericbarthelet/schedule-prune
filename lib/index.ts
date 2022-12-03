// import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface SchedulePruneProps {
  // Define construct properties here
}

export class SchedulePrune extends Construct {

  constructor(scope: Construct, id: string, props: SchedulePruneProps = {}) {
    super(scope, id);

    // Define construct contents here

    // example resource
    // const queue = new sqs.Queue(this, 'SchedulePruneQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
