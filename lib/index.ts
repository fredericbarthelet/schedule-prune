import { AuthorizationType, AwsIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { CallApiGatewayRestApiEndpoint, HttpMethod, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface SchedulePruneProps {
  pruneScheduleExpression?: string;
}

export class SchedulePrune extends Construct {

  constructor(scope: Construct, id: string, props: SchedulePruneProps) {
    super(scope, id);

    // Creating a lambda as a proxy to Scheduler operations
    // To be removed once StepFunction SDK task includes scheduler as well
    const listIrrelevantSchedulesFunction = new NodejsFunction(this, 'ListIrrelevantSchedulesFunction', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'listIrrelevantSchedules.ts'
    })

    const stateMachine = new StateMachine(this, 'StateMachine', {
      definition: new LambdaInvoke(this, 'ListIrrelevantSchedules', {
        lambdaFunction: listIrrelevantSchedulesFunction
      })
    })

    const schedulerRole = new Role(this, 'SchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com')
    })

    stateMachine.grantStartExecution(schedulerRole);

    new CfnSchedule(this, 'Schedule', {
      flexibleTimeWindow: {
        mode: 'OFF',
      },
      scheduleExpression: props.pruneScheduleExpression ?? 'rate(7 days)',
      target: {
        arn: stateMachine.stateMachineArn,
        roleArn: schedulerRole.roleArn,
      }
    })


    //List all schedules
    //Compare schedule expression with current day
    //Delete schedule if more time has passed than retention period

  }
}
