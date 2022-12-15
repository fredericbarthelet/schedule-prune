import { App, Duration, Stack, StackProps } from "aws-cdk-lib";
import { IntegTest, ExpectedResult, Match } from "@aws-cdk/integ-tests-alpha";
import { SchedulePrune } from "../lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnSchedule } from "aws-cdk-lib/aws-scheduler";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc'
dayjs.extend(utc)


class StackUnderTest extends Stack {
    public expectedRelevantScheduleNames: string[] = [];
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        new SchedulePrune(this, 'SchedulePrune', {
            pruneScheduleExpression: 'rate(1 minute)'
        });
        const scheduleRole = new Role(this, 'ScheduleRole', {
            assumedBy: new ServicePrincipal('scheduler.amazonaws.com')
        });
        const targetQueue = new Queue(this, 'TargetQueue', {
            retentionPeriod: Duration.days(14),
        });
        targetQueue.grantSendMessages(scheduleRole);

        const rateBasedScheduleWithoutEndDate = new CfnSchedule(this, 'RateBasedScheduleWithoutEndDate', {
            flexibleTimeWindow: { mode: 'OFF' },
            scheduleExpression: 'rate(1 day)',
            target: {
                arn: targetQueue.queueArn,
                roleArn: scheduleRole.roleArn,
                input: JSON.stringify({
                    schedulerArn: '<aws.scheduler.schedule-arn>'
                })
            }
        });
        this.expectedRelevantScheduleNames.push(rateBasedScheduleWithoutEndDate.ref);

        const rateBasedScheduleWithFutureEndDate =  new CfnSchedule(this, 'RateBasedScheduleWithFutureEndDate', {
            flexibleTimeWindow: { mode: 'OFF' },
            scheduleExpression: 'rate(1 day)',
            endDate: dayjs().utc().add(1, 'month').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
            target: {
                arn: targetQueue.queueArn,
                roleArn: scheduleRole.roleArn,
                input: JSON.stringify({
                    schedulerArn: '<aws.scheduler.schedule-arn>'
                })
            }
        });
        this.expectedRelevantScheduleNames.push(rateBasedScheduleWithFutureEndDate.ref);

        new CfnSchedule(this, 'OneTimeScheduleWithPastDate', {
            flexibleTimeWindow: { mode: 'OFF' },
            scheduleExpression:  dayjs().utc().subtract(1, 'month').format('[at(]YYYY-MM-DDTHH:mm:ss[)]'),
            target: {
                arn: targetQueue.queueArn,
                roleArn: scheduleRole.roleArn,
                input: JSON.stringify({
                    schedulerArn: '<aws.scheduler.schedule-arn>'
                })
            }
        });
    }
}

class AssertionStack extends Stack {
    public assertionFunctionName: string;
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        const assertionFunction = new NodejsFunction(this, 'AssertSchedulesArePruned', {
            entry: 'assertion.schedule-prune.AssertSchedulesArePruned.ts',
        });
        assertionFunction.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEventBridgeSchedulerReadOnlyAccess'))
        this.assertionFunctionName = assertionFunction.functionName;
    }
}

const app = new App();
const testStack = new StackUnderTest(app, 'StackUnderTest');
const assertionStack = new AssertionStack(app, 'AssertionStack');

const testCase = new IntegTest(app, 'Integ', {
    testCases: [testStack],
    assertionStack,
})

testCase.assertions.awsApiCall('Scheduler', 'ListSchedules').expect(ExpectedResult.arrayWith([]))

testCase.assertions.invokeFunction({
    functionName: assertionStack.assertionFunctionName,
    payload: JSON.stringify({ expectedRelevantScheduleNames: testStack.expectedRelevantScheduleNames })
}).expect(ExpectedResult.objectLike({
    Payload: '"Matching"'
}));

app.synth();
